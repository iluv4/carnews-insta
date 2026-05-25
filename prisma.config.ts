import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Use process.env directly: prisma/config's env() throws on a missing var,
    // which broke the `||` fallback when only DATABASE_URL is set (e.g. Vercel).
    url: process.env.DATABASE_POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "",
  },
});
