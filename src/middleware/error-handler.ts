import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten(),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "unexpected_error",
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  res
    .status(500)
    .json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
