import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env/index.js";
import routes from "./routes/index.js";
import mcpRoutes from "./modules/mcp/mcp.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler/index.js";
import { globalLimiter } from "./middleware/rateLimiters/index.js";
import { csrfProtection } from "./middleware/csrfProtection/index.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);

app.use(helmet()); // security headers (no sniffing, no framing, HSTS...)
app.use(
  cors({
    origin: env.frontendUrl, // only our frontend, never "*"
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
  })
);
// The online MCP connector has its own secret, limits and body size, so it sits before the website's limiter and CSRF check
// (an MCP client is not a browser and sends no X-Requested-With header). Not mounted unless MCP_SECRET and MCP_USER_EMAIL are set.
if (env.mcp.enabled) app.use("/mcp", express.json({ limit: "8mb" }), mcpRoutes);

app.use(globalLimiter);
app.use("/api/quizzes", express.json({ limit: "8mb" })); // a quiz file can hold a couple of hundred questions and its SVG diagrams
app.use(express.json({ limit: "10kb" })); // small bodies only
app.use(cookieParser());
app.use(csrfProtection);

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
