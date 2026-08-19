import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middleware/validate";
import { login, register } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schema";
const router = Router();
router.post("/register", validate(registerSchema), asyncHandler(register));
router.post("/login", validate(loginSchema), asyncHandler(login));
export default router;
