import type { RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { allLevels } from "../../shared/catalog.js";
import { cleanList, parseList, toList } from "../../shared/lists.js";
import type { UpdatePlanInput } from "./plans.schemas.js";

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  live: number;
  mocks: boolean;
  popular: boolean;
  features: string[];
  prices: Record<string, string>;
}

export async function list(): Promise<Plan[]> {
  const [plans] = await pool.query<RowDataPacket[]>("SELECT id, name, tagline, live_classes, mocks, popular, features FROM plans ORDER BY position, id");
  const [prices] = await pool.query<RowDataPacket[]>("SELECT plan_id, level_id, price FROM plan_prices");
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    live: p.live_classes,
    mocks: Boolean(p.mocks),
    popular: Boolean(p.popular),
    features: parseList(p.features),
    prices: Object.fromEntries(prices.filter((x) => x.plan_id === p.id).map((x) => [x.level_id as string, x.price as string])),
  }));
}

export async function update(id: string, input: UpdatePlanInput) {
  if (!(await list()).some((p) => p.id === id)) throw new AppError(404, "Plan not found");
  const levels = new Set((await allLevels()).map((l) => l.id));
  await inTransaction(async (conn) => {
    await conn.query("UPDATE plans SET name = ?, tagline = ?, live_classes = ?, mocks = ?, popular = ?, features = ? WHERE id = ?", [
      input.name,
      input.tagline,
      input.live,
      input.mocks ? 1 : 0,
      input.popular ? 1 : 0,
      toList(cleanList(input.features)),
      id,
    ]);
    for (const [levelId, price] of Object.entries(input.prices)) {
      if (!levels.has(levelId)) continue;
      await conn.query("INSERT INTO plan_prices (plan_id, level_id, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = VALUES(price)", [id, levelId, price]);
    }
  });
  return (await list()).find((p) => p.id === id)!;
}
