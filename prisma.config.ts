import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

// Use process.env directly with a placeholder fallback so `prisma generate`
// (which only reads the schema, never connects) works without a configured DB.
// At runtime the real connection string comes from DATABASE_URL via lib/prisma.ts.
const url =
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
});
