import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_PROJECT_ID = "prj_HKHWiHDWakvEE40x1LnQ9h63doDF";
const EXPECTED_BRANCH = "main";
const AUTHORIZED_MIGRATION = "20261125120000_pack_ticket_quantity_overrides";
const PRISMA_CLI = path.join(REPO_ROOT, "node_modules/prisma/build/index.js");

export function parsePendingMigrationStatus(output) {
  if (output.includes("Database schema is up to date!")) return [];

  const marker = /Following migrations? have not yet been applied:\s*\r?\n/i;
  const match = marker.exec(output);
  if (!match) return null;

  const afterMarker = output.slice(match.index + match[0].length);
  const end = afterMarker.search(/\r?\nTo apply migrations in (?:development|production) run /i);
  const pendingBlock = end === -1 ? afterMarker : afterMarker.slice(0, end);
  return pendingBlock
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function redactConnectionString(text) {
  return text.replace(/(postgres(?:ql)?:\/\/)[^:@/\s]+:[^@/\s]+@/gi, "$1[redacted]@");
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    timeout: 5 * 60 * 1000,
    maxBuffer: 2 * 1024 * 1024,
  });

  if (result.error) throw new Error(`Prisma command could not run: ${result.error.message}`);
  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[migration guard] Not a Vercel production build; skipping the one-time migration.");
    return;
  }
  if (process.env.VERCEL_PROJECT_ID !== EXPECTED_PROJECT_ID) {
    throw new Error("Unexpected or missing Vercel project ID; no migration was attempted.");
  }
  if (process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
    throw new Error("This one-time migration is authorized only for the main production branch.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("Production DATABASE_URL is unavailable; no migration was attempted.");
  }

  console.log(`[migration guard] Checking production migration status for ${AUTHORIZED_MIGRATION}.`);
  const before = runPrisma(["migrate", "status"]);
  const pending = parsePendingMigrationStatus(before.output);

  if (before.exitCode === 0 && pending?.length === 0) {
    console.log("[migration guard] Database is already current; no migration was needed.");
    return;
  }

  if (
    before.exitCode !== 1 ||
    pending === null ||
    pending.length !== 1 ||
    pending[0] !== AUTHORIZED_MIGRATION
  ) {
    throw new Error(
      `Production migration status was not exactly one pending migration (${AUTHORIZED_MIGRATION}); no migration was attempted.`,
    );
  }

  console.log(`[migration guard] Applying only ${AUTHORIZED_MIGRATION}.`);
  const applied = runPrisma(["migrate", "deploy"]);
  if (applied.output.trim()) process.stdout.write(redactConnectionString(applied.output));
  if (applied.exitCode !== 0) {
    throw new Error(`Prisma migrate deploy failed with exit code ${applied.exitCode}.`);
  }

  const after = runPrisma(["migrate", "status"]);
  if (after.exitCode !== 0 || !after.output.includes("Database schema is up to date!")) {
    throw new Error("Post-migration status did not confirm a fully up-to-date database.");
  }

  console.log(`[migration guard] ${AUTHORIZED_MIGRATION} applied and verified.`);
}

main().catch((error) => {
  console.error(`[migration guard] STOPPED: ${error.message}`);
  process.exitCode = 1;
});
