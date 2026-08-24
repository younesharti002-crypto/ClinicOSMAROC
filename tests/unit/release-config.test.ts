import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function rootFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("M8 release configuration", () => {
  it("keeps environment files ignored and committed env values as placeholders", () => {
    const gitignore = rootFile(".gitignore");
    const example = rootFile(".env.example");

    expect(gitignore).toContain(".env\n");
    expect(gitignore).toContain(".env.local");
    expect(example).toContain("DATABASE_URL=\"postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require\"");
    expect(example).toContain("SESSION_SECRET=\"replace-with-a-long-random-secret\"");
    expect(example).toContain("WHATSAPP_ACCESS_TOKEN=\"replace-at-live-integration-time\"");
    expect(example).not.toMatch(/EA[A-Za-z0-9]{30,}/);
    expect(example).not.toMatch(/postgresql:\/\/[^\s\"]+:[^\s\"]+@[^\s\"]+\.(?:neon|supabase|render)\./i);
  });

  it("fails production builds closed on missing core env and applies committed migrations", () => {
    const buildScript = rootFile("scripts/vercel-build.mjs");

    expect(buildScript).toContain('process.env.VERCEL_ENV === "production"');
    expect(buildScript).toContain('DATABASE_URL is required for a production deployment');
    expect(buildScript).toContain('SESSION_SECRET must contain at least 32 characters in production');
    expect(buildScript).toContain('run("npx", ["prisma", "migrate", "deploy"])');
    expect(buildScript).not.toContain("prisma db push");
    expect(buildScript).not.toContain("db:seed");
  });

  it("keeps the health check dynamic, database-backed, uncached, and failure-aware", () => {
    const healthRoute = rootFile("src/app/api/health/route.ts");

    expect(healthRoute).toContain('dynamic = "force-dynamic"');
    expect(healthRoute).toContain("SELECT 1");
    expect(healthRoute).toContain('"Cache-Control": "no-store"');
    expect(healthRoute).toContain('status: "ok"');
    expect(healthRoute).toContain('status: "unavailable"');
    expect(healthRoute).toContain("status: 503");
  });
});
