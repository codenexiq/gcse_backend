import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Reports from "./reports.model.js";

export const markSent = asyncHandler(async (req, res) => {
  const id = idParam(req.params.id);
  if (!id) throw new AppError(404, "Report not found");
  await Reports.markSent(id);
  res.json({ sent: true });
});
