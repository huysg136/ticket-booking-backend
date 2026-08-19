import { Router } from "express";
import { UserRole } from "../../generated/prisma/client";
import { authenticate, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import * as c from "./operation.controller";
import * as s from "./operation.schema";
const router = Router();
router.use(authenticate, requireRole(UserRole.OPERATOR, UserRole.ADMIN));
router.get("/bookings", validate(s.listSchema), asyncHandler(c.list));
router.get("/bookings/:id", validate(s.idSchema), asyncHandler(c.get));
router.patch("/bookings/:id/status", validate(s.statusSchema), asyncHandler(c.status));
router.post("/concerts", validate(s.concertSchema), asyncHandler(c.concert));
router.patch("/concerts/:id/publish", validate(s.idSchema), asyncHandler(c.publish));
router.get(
  "/ticket-categories/:id/availability",
  validate(s.idSchema),
  asyncHandler(c.availability),
);
router.post("/vouchers", validate(s.voucherSchema), asyncHandler(c.voucher));
router.get("/vouchers", asyncHandler(c.vouchers));
export default router;
