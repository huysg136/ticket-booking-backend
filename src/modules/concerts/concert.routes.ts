import { Router } from "express";
import { getConcert, getConcerts } from "./concert.controller";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
const router = Router();
const idSchema = z.object({
  body: z.any(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}),
  headers: z.any(),
});
/** @swagger
 * /api/concerts:
 *   get:
 *     summary: List published concerts
 *     responses:
 *       200: { description: OK }
 */
router.get("/", asyncHandler(getConcerts));
/** @swagger
 * /api/concerts/{id}:
 *   get:
 *     summary: Get concert detail and availability
 *     responses:
 *       200: { description: OK }
 */
router.get("/:id", validate(idSchema), asyncHandler(getConcert));
export default router;
