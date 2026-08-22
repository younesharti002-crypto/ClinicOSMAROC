import { spawnSync } from "node:child_process";

function run(command, args) {
  const executable = process.platform === "win32" && command === "npx" ? "npx.cmd" : command;
  const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function requireProductionEnv() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for a production deployment");
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
  }
}

const isVercelProduction = process.env.VERCEL_ENV === "production";

if (isVercelProduction) {
  requireProductionEnv();
  console.log("ClinicOS production build: applying committed Prisma migrations...");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log("ClinicOS non-production build: skipping production database migrations.");
}

run("npx", ["next", "build"]);
