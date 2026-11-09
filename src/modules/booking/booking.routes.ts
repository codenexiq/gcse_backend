import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { cancelBooking, createBooking, listBookings, logBooking } from "./booking.controller.js";
import { bookingLogSchema, bookingSchema } from "./booking.schemas.js";

// Mounted at /tutor/bookings. Tutors and admins keep their calendar here.
const router = Router();

router.use(requireRole("tutor", "admin"));
router.get("/", listBookings);
router.post("/", validate(bookingSchema), createBooking);
router.delete("/:id", cancelBooking);
router.post("/:id/log", validate(bookingLogSchema), logBooking);

export default router;
