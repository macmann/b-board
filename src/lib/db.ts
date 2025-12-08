import { PrismaClient } from "@prisma/client";

type PrismaClientSingleton = PrismaClient & { __isSingleton?: true };

declare const globalThis: {
  prisma?: PrismaClientSingleton;
} & typeof global;

function createMockPrismaClient() {
  const handler: ProxyHandler<any> = {
    get() {
      return new Proxy(() => {}, {
        apply() {
          return Promise.resolve(null);
        },
        get() {
          return handler.get?.call(null);
        },
      });
    },
  };
  return new Proxy({}, handler) as unknown as PrismaClient;
}

let prismaInternal: PrismaClient;

try {
  prismaInternal = globalThis.prisma || new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prismaInternal as PrismaClientSingleton;
  }
} catch (error) {
  console.warn(
    "Prisma client failed to initialize, using a mock client for build time:",
    error
  );
  prismaInternal = createMockPrismaClient();
}

const prisma = prismaInternal;

export default prisma;
export { prisma };
