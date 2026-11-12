import { Router } from "express";
import { validate } from "../../../middleware/validate/index.js";
import { createItem, createRoute, deleteItem, deleteRoute, duplicateRoute, getItem, getRoute, library, paths, routes, saveItem, saveRoute } from "./content.controller.js";
import { createItemSchema, createRouteSchema, saveItemSchema, saveRouteSchema } from "./content.schemas.js";

// Mounted at /tutor/content. Everything is limited to the subjects an admin gave this tutor.
const router = Router();
router.get("/paths", paths);
router.get("/library", library);
router.post("/items", validate(createItemSchema), createItem);
router.get("/items/:id", getItem);
router.put("/items/:id", validate(saveItemSchema), saveItem);
router.delete("/items/:id", deleteItem);
router.get("/routes", routes);
router.post("/routes", validate(createRouteSchema), createRoute);
router.get("/routes/:id", getRoute);
router.put("/routes/:id", validate(saveRouteSchema), saveRoute);
router.post("/routes/:id/duplicate", duplicateRoute);
router.delete("/routes/:id", deleteRoute);

export default router;
