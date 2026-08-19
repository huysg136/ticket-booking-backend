import { z } from "zod";
export const createBookingSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          ticketCategoryId: z.string().uuid(),
          quantity: z.number().int().positive().max(10),
        }),
      )
      .min(1)
      .max(10)
      .refine(
        (items) => new Set(items.map((i) => i.ticketCategoryId)).size === items.length,
        "Duplicate ticket categories are not allowed",
      ),
    voucherCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .transform((v) => v.toUpperCase())
      .optional(),
  }),
  params: z.object({}),
  query: z.object({}),
  headers: z.object({ "idempotency-key": z.string().min(8).max(128) }).passthrough(),
});
export const bookingIdSchema = z.object({
  body: z.any(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}),
  headers: z.any(),
});
