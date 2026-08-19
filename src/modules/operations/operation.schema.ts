import { z } from "zod";
const empty = z.object({});
const id = z.object({ id: z.string().uuid() });
export const listSchema = z.object({
  body: z.any(),
  params: empty,
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["RECEIVED", "WAITING_FOR_PAYMENT", "PAID", "CANCELLED", "EXPIRED"]).optional(),
    suspicious: z.enum(["true", "false"]).optional(),
  }),
  headers: z.any(),
});
export const idSchema = z.object({ body: z.any(), params: id, query: empty, headers: z.any() });
export const statusSchema = z.object({
  body: z.object({ status: z.enum(["WAITING_FOR_PAYMENT", "PAID", "CANCELLED", "EXPIRED"]) }),
  params: id,
  query: empty,
  headers: z.any(),
});
export const concertSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    venue: z.string().min(1).max(200),
    startAt: z.coerce.date(),
    ticketCategories: z
      .array(
        z.object({
          name: z.string().min(1),
          price: z.coerce.number().int().positive(),
          totalQuantity: z.number().int().positive(),
        }),
      )
      .min(1)
      .optional(),
  }),
  params: empty,
  query: empty,
  headers: z.any(),
});
export const voucherSchema = z.object({
  body: z
    .object({
      code: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .transform((v) => v.toUpperCase()),
      type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
      value: z.coerce.number().positive(),
      usageLimit: z.number().int().positive(),
      startsAt: z.coerce.date(),
      expiresAt: z.coerce.date(),
      active: z.boolean().default(true),
      minOrderAmount: z.coerce.number().nonnegative().optional(),
      maxDiscountAmount: z.coerce.number().positive().optional(),
    })
    .refine((v) => v.expiresAt > v.startsAt, { message: "expiresAt must be after startsAt" })
    .refine((v) => v.type !== "PERCENTAGE" || v.value <= 100, {
      message: "Percentage cannot exceed 100",
    }),
  params: empty,
  query: empty,
  headers: z.any(),
});
