import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { enquiryLimiter } from "../../middleware/rateLimiters/index.js";
import { deleteEnquiry, getEnquiries, getPosts, getProducts, getReviews, getTeam, sendEnquiry, updateEnquiry } from "./site.controller.js";
import { enquirySchema, enquiryStatusSchema } from "./site.schemas.js";

// Mounted at /site (public): the content of the website and the contact form.
export const siteRoutes = Router();
siteRoutes.get("/posts", getPosts);
siteRoutes.get("/products", getProducts);
siteRoutes.get("/team", getTeam);
siteRoutes.get("/reviews", getReviews);
siteRoutes.post("/enquiries", enquiryLimiter, validate(enquirySchema), sendEnquiry);

// Mounted at /tutor/enquiries (admins only): the inbox for the contact form.
export const enquiryAdminRoutes = Router();
enquiryAdminRoutes.use(requireRole("admin"));
enquiryAdminRoutes.get("/", getEnquiries);
enquiryAdminRoutes.patch("/:id", validate(enquiryStatusSchema), updateEnquiry);
enquiryAdminRoutes.delete("/:id", deleteEnquiry);
