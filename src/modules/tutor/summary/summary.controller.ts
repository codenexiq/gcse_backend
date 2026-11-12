import { asyncHandler } from "../../../utils/asyncHandler/index.js";
import { summary } from "./summary.model.js";

export const get = asyncHandler(async (req, res) => void res.json(await summary(req.user!.id, req.user!.fullName)));
