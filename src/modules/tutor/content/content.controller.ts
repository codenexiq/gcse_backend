import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Content from "./content.model.js";

const idOf = (v: string | string[] | undefined) => {
  const id = idParam(v);
  if (!id) throw new AppError(404, "Not found");
  return id;
};
const pathOf = (req: { query: Record<string, unknown> }) => {
  const subject = String(req.query.subject ?? "");
  const level = String(req.query.level ?? "");
  if (!subject || !level) throw new AppError(400, "Choose a subject and level.");
  return { subject, level };
};

export const paths = asyncHandler(async (req, res) => void res.json(await Content.paths(req.user!.id)));
export const library = asyncHandler(async (req, res) => {
  const { subject, level } = pathOf(req);
  res.json(await Content.library(req.user!.id, subject, level));
});
export const getItem = asyncHandler(async (req, res) => void res.json(await Content.getItem(req.user!.id, idOf(req.params.id))));
export const createItem = asyncHandler(async (req, res) => void res.status(201).json(await Content.createItem(req.user!.id, req.body.subject, req.body.level, req.body.kind)));
export const saveItem = asyncHandler(async (req, res) => {
  await Content.saveItem(req.user!.id, idOf(req.params.id), req.body);
  res.json({ saved: true });
});
export const deleteItem = asyncHandler(async (req, res) => {
  await Content.deleteItem(req.user!.id, idOf(req.params.id));
  res.json({ deleted: true });
});

export const routes = asyncHandler(async (req, res) => {
  const { subject, level } = pathOf(req);
  res.json(await Content.routes(req.user!.id, subject, level));
});
export const getRoute = asyncHandler(async (req, res) => void res.json(await Content.getRoute(req.user!.id, idOf(req.params.id))));
export const createRoute = asyncHandler(async (req, res) => void res.status(201).json(await Content.createRoute(req.user!.id, req.body.subject, req.body.level)));
export const saveRoute = asyncHandler(async (req, res) => {
  await Content.saveRoute(req.user!.id, idOf(req.params.id), req.body);
  res.json({ saved: true });
});
export const duplicateRoute = asyncHandler(async (req, res) => void res.status(201).json(await Content.duplicateRoute(req.user!.id, idOf(req.params.id))));
export const deleteRoute = asyncHandler(async (req, res) => {
  await Content.deleteRoute(req.user!.id, idOf(req.params.id));
  res.json({ deleted: true });
});
