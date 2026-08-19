import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../src/generated/prisma/client";
import { authenticate, requireRole } from "../src/middleware/auth";

describe("authentication and RBAC middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "middleware-test-secret";
  });

  test("authenticates a valid bearer token", () => {
    const token = jwt.sign({ role: UserRole.CUSTOMER }, "middleware-test-secret", {
      subject: "user-1",
    });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(req.user).toEqual({ id: "user-1", role: UserRole.CUSTOMER });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("rejects a missing or invalid token without exposing details", () => {
    expect(() => authenticate({ headers: {} } as Request, {} as Response, jest.fn())).toThrow(
      expect.objectContaining({ status: 401, code: "UNAUTHORIZED" }),
    );
    expect(() =>
      authenticate(
        { headers: { authorization: "Bearer invalid-token" } } as Request,
        {} as Response,
        jest.fn(),
      ),
    ).toThrow(expect.objectContaining({ status: 401, code: "UNAUTHORIZED" }));
  });

  test("allows configured roles and rejects customers from operation routes", () => {
    const middleware = requireRole(UserRole.OPERATOR, UserRole.ADMIN);
    const next = jest.fn() as NextFunction;

    middleware(
      { user: { id: "operator-1", role: UserRole.OPERATOR } } as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);

    expect(() =>
      middleware(
        { user: { id: "customer-1", role: UserRole.CUSTOMER } } as Request,
        {} as Response,
        jest.fn(),
      ),
    ).toThrow(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
  });
});
