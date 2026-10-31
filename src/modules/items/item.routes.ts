import { Router } from "express";
import { validate } from "../../middleware/validate/index.js";
import { getItems, createItem } from "./item.controller.js";
import { createItemSchema } from "./item.schemas.js";

const router = Router();

router.get("/", getItems);
router.post("/", validate(createItemSchema), createItem);

export default router;
