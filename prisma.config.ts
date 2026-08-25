import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

/**
 * Prisma 7 CLI configuration.
 *
 * - `schema`     : location of the Prisma schema.
 * - `datasource` : connection used by CLI commands such as
 *                  `prisma migrate dev` / `prisma migrate deploy`.
 *
 * The runtime application does NOT read this file — PrismaService builds the
 * client with the PrismaPg driver adapter using the same DATABASE_URL.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
