import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

// Runtime uses Neon's pooled URL over node-postgres (Neon skill: pg on Vercel Fluid compute).
const createClient = () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Lets Vercel close idle connections before suspending the function instance.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
