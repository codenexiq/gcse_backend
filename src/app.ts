import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env/index.js";
import routes from "./routes/index.js";
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
app.use(globalLimiter);
app.use(express.json({ limit: "10kb" })); // small bodies only
app.use(cookieParser());
app.use(csrfProtection);

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
