import { PrismaClient } from "@prisma/client";

type PrismaClientSingleton = PrismaClient & { __isSingleton?: true };

declare const globalThis: {
  prisma?: PrismaClientSingleton;
} & typeof global;

const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma as PrismaClientSingleton;
}

export default prisma;
