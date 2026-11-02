import { Router } from "express";
import { rawFile } from "../../middleware/rawFile/index.js";
import { chatReadLimiter, chatWriteLimiter } from "../../middleware/rateLimiters/index.js";
import { validate } from "../../middleware/validate/index.js";
import { addMembers, createGroup, deleteGroup, listGroups, postMessage, readGroup, readMessages, removeMember, removeMessage, updateGroup, uploadAttachment } from "./chatGroup.controller.js";
import { addMembersSchema, createGroupSchema, sendGroupMessageSchema, updateGroupSchema } from "./chatGroup.schemas.js";

// Mounted at /chat/groups. Admins make and manage groups; the students in a group (and every admin) talk in it.
// The controller checks on every request that the person may open the group, so nobody can reach a group they are not in.
const router = Router();

router.get("/", chatReadLimiter, listGroups);
router.post("/", chatWriteLimiter, validate(createGroupSchema), createGroup);
router.get("/:id", chatReadLimiter, readGroup);
router.put("/:id", chatWriteLimiter, validate(updateGroupSchema), updateGroup);
router.delete("/:id", chatWriteLimiter, deleteGroup);

router.post("/:id/members", chatWriteLimiter, validate(addMembersSchema), addMembers);
router.delete("/:id/members/:userId", chatWriteLimiter, removeMember);

router.get("/:id/messages", chatReadLimiter, readMessages);
router.post("/:id/messages", chatWriteLimiter, validate(sendGroupMessageSchema), postMessage);
router.delete("/:id/messages/:messageId", chatWriteLimiter, removeMessage);
router.post("/:id/attachments", chatWriteLimiter, rawFile, uploadAttachment);

export default router;
