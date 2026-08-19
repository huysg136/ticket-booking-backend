import { z } from "zod";
const credentials = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
});
export const registerSchema = z.object({
  body: credentials,
  params: z.object({}),
  query: z.object({}),
  headers: z.any(),
});
export const loginSchema = registerSchema;
