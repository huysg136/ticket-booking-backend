import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "../../database/prisma";
import { conflict, unauthorized } from "../../utils/errors";
const issueToken = (user: { id: string; role: "CUSTOMER" | "OPERATOR" | "ADMIN" }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ role: user.role }, secret, {
    subject: user.id,
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],
  });
};
export async function register(email: string, password: string) {
  if (await prisma.user.findUnique({ where: { email } }))
    throw conflict("EMAIL_ALREADY_EXISTS", "An account with this email already exists");
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 12) },
    select: { id: true, email: true, role: true },
  });
  return { user, token: issueToken(user) };
}
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw unauthorized("Invalid email or password");
  return { user: { id: user.id, email: user.email, role: user.role }, token: issueToken(user) };
}
