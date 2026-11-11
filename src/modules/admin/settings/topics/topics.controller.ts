import { asyncHandler } from "../../../../utils/asyncHandler/index.js";
import * as Topics from "./topics.model.js";

const text = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : (v ?? ""));

export const paths = asyncHandler(async (_req, res) => void res.json(await Topics.paths()));

export const get = asyncHandler(async (req, res) => {
  // The diagnostic questions for a pathway belong to the student area, which is built later.
  res.json({ strands: await Topics.strandsOf(text(req.params.subjectId), text(req.params.levelId)), diagnosticQuestions: 0 });
});

export const save = asyncHandler(async (req, res) => {
  res.json({ strands: await Topics.save(text(req.params.subjectId), text(req.params.levelId), req.body), diagnosticQuestions: 0 });
});
