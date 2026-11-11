import { asyncHandler } from "../../../utils/asyncHandler/index.js";
import { lookups } from "./lookups.model.js";

export const get = asyncHandler(async (_req, res) => void res.json(await lookups()));
