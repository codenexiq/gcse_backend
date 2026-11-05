import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { env } from "../../config/env/index.js";
import * as User from "../auth/user.model.js";
import { createMcpServer, type Actor } from "./mcp.server.js";

// The online MCP connector for claude.ai and Claude Code. Mounted at /mcp by app.ts, ONLY when MCP_SECRET and MCP_USER_EMAIL are set.
//
// The address is  https://<api host>/mcp/<MCP_SECRET>  : the secret in the address is the password (claude.ai custom connectors cannot send one).
// Every call runs as the one account in MCP_USER_EMAIL (a tutor or admin), so it can only do what that account can do on the website.
// Change MCP_SECRET to cut off every connector that has the old address.
const router = Router();

const sha = (text: string) => createHash("sha256").update(text).digest();
const expected = sha(env.mcp.secret);

// Wrong guesses are slowed right down (only failed requests count), and normal use has its own ceiling.
const guessLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { message: "Not found" }, statusCode: 404 });
const useLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests, please try again later" } });
router.use(guessLimiter, useLimiter);

/** The secret in the address must match. Anything else looks like a page that does not exist. */
function checkSecret(req: Request, res: Response, next: NextFunction) {
  const given = sha(String(req.params.secret ?? ""));
  if (!timingSafeEqual(given, expected)) return void res.status(404).json({ message: "Not found" });
  next();
}

/** Finds the account the connector acts as, and makes sure it is still allowed to. Checked on every call. */
async function actor(): Promise<Actor | null> {
  const user = await User.findByEmail(env.mcp.userEmail);
  if (!user || !user.is_active || (user.role !== "tutor" && user.role !== "admin")) return null;
  return { id: user.id, role: user.role, fullName: user.full_name };
}

const notAllowed = (res: Response) => res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });

// Stateless: each request gets its own small server, answered as plain JSON.
router.post("/:secret", checkSecret, async (req: Request, res: Response) => {
  try {
    const who = await actor();
    if (!who) return void res.status(503).json({ jsonrpc: "2.0", error: { code: -32001, message: "The connector's account is not available." }, id: null });
    const server = createMcpServer(who);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
  }
});
router.get("/:secret", checkSecret, (_req, res) => notAllowed(res));
router.delete("/:secret", checkSecret, (_req, res) => notAllowed(res));

export default router;
