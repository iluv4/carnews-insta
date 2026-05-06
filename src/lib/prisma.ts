import { PrismaClient } from '@prisma/client';

// DB URL이 없으면 Prisma 클라이언트를 생성하지 않음
// → templates/cards API만 비활성화되고 나머지 앱은 정상 동작
const connectionString =
  process.env.DATABASE_POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

function createPrismaClient(): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인하세요.');
  }

  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ['query'] });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma: PrismaClient = (() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  return client;
})();
