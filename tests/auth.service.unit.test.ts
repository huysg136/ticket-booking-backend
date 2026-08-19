import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockFindUnique = jest.fn<(...args: unknown[]) => Promise<any>>();
const mockCreate = jest.fn<(...args: unknown[]) => Promise<any>>();
const mockHash = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockCompare = jest.fn<(...args: unknown[]) => Promise<boolean>>();
const mockSign = jest.fn<(...args: unknown[]) => string>();

jest.mock("../src/database/prisma", () => ({
  prisma: { user: { findUnique: mockFindUnique, create: mockCreate } },
}));
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: { hash: mockHash, compare: mockCompare },
}));
jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: { sign: mockSign },
}));

import { login, register } from "../src/modules/auth/auth.service";
import { AppError } from "../src/utils/errors";

describe("authentication service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "unit-test-secret";
    process.env.JWT_EXPIRES_IN = "1d";
    mockSign.mockReturnValue("signed-token");
  });

  test("rejects registration when the email already exists", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-user" });

    await expect(register("customer@example.com", "Assignment123!")).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_ALREADY_EXISTS",
    } satisfies Partial<AppError>);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("hashes a password and returns a token for a new account", async () => {
    const user = { id: "user-1", email: "customer@example.com", role: "CUSTOMER" };
    mockFindUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue("password-hash");
    mockCreate.mockResolvedValue(user);

    await expect(register(user.email, "Assignment123!")).resolves.toEqual({
      user,
      token: "signed-token",
    });
    expect(mockHash).toHaveBeenCalledWith("Assignment123!", 12);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: user.email, passwordHash: "password-hash" } }),
    );
  });

  test("does not reveal whether login failed because of email or password", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(login("missing@example.com", "Assignment123!")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    } satisfies Partial<AppError>);

    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "customer@example.com",
      role: "CUSTOMER",
      passwordHash: "stored-hash",
    });
    mockCompare.mockResolvedValue(false);
    await expect(login("customer@example.com", "wrong-password")).rejects.toMatchObject({
      message: "Invalid email or password",
    });
  });

  test("returns the public user and JWT after valid credentials", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "customer@example.com",
      role: "CUSTOMER",
      passwordHash: "stored-hash",
    });
    mockCompare.mockResolvedValue(true);

    await expect(login("customer@example.com", "Assignment123!")).resolves.toEqual({
      user: { id: "user-1", email: "customer@example.com", role: "CUSTOMER" },
      token: "signed-token",
    });
    expect(mockSign).toHaveBeenCalledWith(
      { role: "CUSTOMER" },
      "unit-test-secret",
      expect.objectContaining({ subject: "user-1", expiresIn: "1d" }),
    );
  });
});
