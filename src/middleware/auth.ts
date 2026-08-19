import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/prisma/client";
import { forbidden, unauthorized } from "../utils/errors";

type TokenPayload = { sub: string; role: UserRole };

export const authenticate: RequestHandler = (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  const secret = process.env.JWT_SECRET;
  if (scheme !== "Bearer" || !token || !secret) throw unauthorized();
  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    if (!payload.sub || !Object.values(UserRole).includes(payload.role))
      throw unauthorized("Invalid token payload");
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw unauthorized("Invalid or expired token");
  }
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
