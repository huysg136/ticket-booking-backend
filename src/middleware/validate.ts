import { RequestHandler } from "express";
import { ZodType } from "zod";

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
    }) as { body: unknown; params: typeof req.params; query: typeof req.query };
    req.body = parsed.body;
    req.params = parsed.params;
    Object.assign(req.query, parsed.query);
    next();
  };
