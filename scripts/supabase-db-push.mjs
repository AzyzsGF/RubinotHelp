import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const projectRef = "zzfqvclrqhlbqcmdnxpa";
const localEnvFile = ".env.supabase.local";

function loadLocalEnv(path) {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function buildDbUrl() {
  const explicitUrl = process.env.SUPABASE_DB_URL?.trim();
  if (explicitUrl) {
    if (explicitUrl.includes("[YOUR-PASSWORD]")) {
      throw new Error("SUPABASE_DB_URL ainda contem [YOUR-PASSWORD].");
    }

    return explicitUrl;
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      [
        "Defina a senha do Postgres antes de rodar este comando.",
        "",
        `Crie ${localEnvFile} com uma destas opcoes:`,
        "SUPABASE_DB_PASSWORD=sua-senha-do-banco",
        "",
        "ou:",
        `SUPABASE_DB_URL=postgresql://postgres:sua-senha-do-banco@db.${projectRef}.supabase.co:5432/postgres`,
        "",
        "Esse arquivo ja fica ignorado pelo Git."
      ].join("\n")
    );
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

loadLocalEnv(localEnvFile);

let dbUrl;
try {
  dbUrl = buildDbUrl();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npx,
  ["supabase", "db", "push", "--db-url", dbUrl, "--yes"],
  {
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
