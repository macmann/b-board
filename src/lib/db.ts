import { PrismaClient } from "@prisma/client";

type PrismaClientSingleton = PrismaClient & { __isSingleton?: true };

declare const globalThis: {
  prisma?: PrismaClientSingleton;
} & typeof global;

function createMockPrismaClient() {
  const handler: ProxyHandler<Record<string, unknown>> = {
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

let prisma: PrismaClient;

try {
  prisma = globalThis.prisma || new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prisma as PrismaClientSingleton;
  }
} catch (error) {
  console.warn("Prisma client failed to initialize, using a mock client for build time:", error);
  prisma = createMockPrismaClient();
}

export { prisma };
export default prisma;
