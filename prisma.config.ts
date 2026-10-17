import { defineConfig } from "prisma/config";

// Prisma 7 doesn't load env files itself; .env.local is written by `neon deploy`.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI/Vercel provide env vars directly.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node prisma/seed.mts" },
  // CLI (migrate) uses the direct connection; PgBouncer breaks Prisma Migrate. Optional so that
  // `prisma generate` (postinstall) also works in CI jobs that have no database.
  datasource: process.env.DATABASE_URL_UNPOOLED ? { url: process.env.DATABASE_URL_UNPOOLED } : undefined,
});
