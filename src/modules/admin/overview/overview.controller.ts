import { asyncHandler } from "../../../utils/asyncHandler/index.js";
import * as Overview from "./overview.model.js";

export const get = asyncHandler(async (_req, res) => void res.json(await Overview.overview()));
export const attention = asyncHandler(async (_req, res) => void res.json(await Overview.attention()));
