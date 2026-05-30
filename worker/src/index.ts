import { corsHeaders, handleBoostedRequest } from "./boosted";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  EVOLUTION_BASE_URL: string;
  EVOLUTION_API_KEY: string;
  EVOLUTION_INSTANCE: string;
  CRON_SECRET?: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface JobRow {
  id: string;
  user_id: string;
  checkin_id: string;
  scheduled_for: string;
  attempts: number;
}

interface ProfileRow {
  nick: string;
  whatsapp: string;
  whatsapp_opt_in: boolean;
}

interface CheckinRow {
  boss_id: string;
  cooldown_ends_at: string;
}

interface BossRow {
  name: string;
}

interface RunSummary {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

const MAX_ATTEMPTS = 5;

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method === "GET" && url.pathname === "/rubinot/boosted") {
      return handleBoostedRequest();
    }

    if (request.method === "POST" && url.pathname === "/run") {
      if (env.CRON_SECRET && request.headers.get("x-cron-secret") !== env.CRON_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }

      return json(await processDueJobs(env));
    }

    return json({
      ok: true,
      service: "rubinot-help-notifications",
      routes: ["GET /rubinot/boosted", "POST /run"]
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processDueJobs(env));
  }
};

async function processDueJobs(env: Env): Promise<RunSummary> {
  assertEnv(env);

  const jobs = await fetchPendingJobs(env);
  const summary: RunSummary = {
    processed: jobs.length,
    sent: 0,
    failed: 0,
    skipped: 0
  };

  for (const job of jobs) {
    try {
      const profile = await getSingle<ProfileRow>(env, "profiles", {
        select: "nick,whatsapp,whatsapp_opt_in",
        id: `eq.${job.user_id}`
      });
      const checkin = await getSingle<CheckinRow>(env, "boss_checkins", {
        select: "boss_id,cooldown_ends_at",
        id: `eq.${job.checkin_id}`
      });
      const boss = await getSingle<BossRow>(env, "bosses", {
        select: "name",
        id: `eq.${checkin.boss_id}`
      });

      if (!profile.whatsapp || !profile.whatsapp_opt_in) {
        await patchJob(env, job.id, {
          status: "skipped",
          attempts: job.attempts + 1,
          last_error: "Perfil sem WhatsApp ou opt-in."
        });
        summary.skipped += 1;
        continue;
      }

      const text = buildMessage(profile, boss, checkin);
      await sendWhatsApp(env, profile.whatsapp, text);
      await patchJob(env, job.id, {
        status: "sent",
        attempts: job.attempts + 1,
        sent_at: new Date().toISOString(),
        last_error: null
      });
      summary.sent += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      await patchJob(env, job.id, {
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        scheduled_for:
          attempts >= MAX_ATTEMPTS
            ? job.scheduled_for
            : new Date(Date.now() + retryDelayMinutes(attempts) * 60_000).toISOString(),
        last_error: error instanceof Error ? error.message : "Erro desconhecido."
      });
      summary.failed += 1;
    }
  }

  return summary;
}

function assertEnv(env: Env) {
  const required: Array<keyof Env> = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "EVOLUTION_BASE_URL",
    "EVOLUTION_API_KEY",
    "EVOLUTION_INSTANCE"
  ];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

async function fetchPendingJobs(env: Env) {
  const params = new URLSearchParams({
    select: "id,user_id,checkin_id,scheduled_for,attempts",
    status: "eq.pending",
    scheduled_for: `lte.${new Date().toISOString()}`,
    order: "scheduled_for.asc",
    limit: "25"
  });

  return supabaseFetch<JobRow[]>(env, `/rest/v1/notification_jobs?${params.toString()}`);
}

async function getSingle<T>(
  env: Env,
  table: string,
  params: Record<string, string>
): Promise<T> {
  const query = new URLSearchParams(params);
  query.set("limit", "1");

  const rows = await supabaseFetch<T[]>(env, `/rest/v1/${table}?${query.toString()}`);
  if (!rows[0]) {
    throw new Error(`Registro nao encontrado em ${table}.`);
  }

  return rows[0];
}

async function patchJob(env: Env, id: string, payload: Record<string, unknown>) {
  await supabaseFetch(env, `/rest/v1/notification_jobs?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });
}

async function supabaseFetch<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 300)}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildMessage(profile: ProfileRow, boss: BossRow, checkin: CheckinRow) {
  const nick = profile.nick || "jogador";
  const readyAt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(checkin.cooldown_ends_at));

  return `Rubinot Help: ${boss.name} saiu do cooldown para ${nick}. Horario: ${readyAt}.`;
}

async function sendWhatsApp(env: Env, number: string, text: string) {
  const baseUrl = env.EVOLUTION_BASE_URL.replace(/\/$/, "");
  const endpoint = `${baseUrl}/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number,
      text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Evolution API ${response.status}: ${body.slice(0, 300)}`);
  }
}

function retryDelayMinutes(attempts: number) {
  return Math.min(30, attempts * 5);
}

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
