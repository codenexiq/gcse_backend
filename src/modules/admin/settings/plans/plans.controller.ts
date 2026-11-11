import { asyncHandler } from "../../../../utils/asyncHandler/index.js";
import * as Plans from "./plans.model.js";

export const list = asyncHandler(async (_req, res) => void res.json(await Plans.list()));
export const update = asyncHandler(async (req, res) => void res.json(await Plans.update(String(req.params.id), req.body)));
