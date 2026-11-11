import { asyncHandler } from "../../../../utils/asyncHandler/index.js";
import * as Signup from "./signup.model.js";

export const get = asyncHandler(async (_req, res) => void res.json(await Signup.get()));
export const save = asyncHandler(async (req, res) => void res.json(await Signup.save(req.body.welcome)));
