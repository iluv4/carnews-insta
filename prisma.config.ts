import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

// env() throws if the variable is missing — use process.env directly so
// `prisma generate` (which doesn't need a real DB connection) still works
// on CI / Vercel even before DATABASE_URL is configured.
const dbUrl =
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
});
