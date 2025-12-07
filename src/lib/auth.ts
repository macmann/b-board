import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { User } from "@prisma/client";

import prisma from "./db";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Please define it in your environment.");
}

export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, 10);
};

export const comparePassword = async (
  plain: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

export const signAuthToken = (payload: { userId: string }): string => {
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
};

export const verifyAuthToken = (
  token: string
): { userId: string } | null => {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as {
      userId: string;
    };
  } catch (error) {
    return null;
  }
};

export const getUserFromRequest = async (
  request: NextRequest
): Promise<User | null> => {
  const token = request.cookies.get("auth_token")?.value;

  if (!token) return null;

  const payload = verifyAuthToken(token);

  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  return user;
};
