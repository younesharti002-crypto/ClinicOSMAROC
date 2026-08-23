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
const createSyntheticDemo =
  process.env.DEMO_CONFIRM === "CREATE_SYNTHETIC_DEMO";

if (isVercelProduction) {
  requireProductionEnv();
  console.log("ClinicOS production build: applying committed Prisma migrations...");
  run("npx", ["prisma", "migrate", "deploy"]);

  if (createSyntheticDemo) {
    console.log("ClinicOS production build: ensuring synthetic commercial demo tenant...");
    run("node", ["prisma/seed-demo.mjs"]);
  } else {
    console.log("ClinicOS production build: synthetic demo seed not requested.");
  }
} else {
  console.log("ClinicOS non-production build: skipping production database migrations and demo seed.");
}

run("npx", ["next", "build"]);
