export type BoostedCreatureType = "boss" | "monster";

export interface BoostedCreature {
  type: BoostedCreatureType;
  label: string;
  name: string;
  imageUrl: string;
  href?: string;
}

export interface BoostedPayload {
  sourceUrl: string;
  fetchedAt: string;
  boss?: BoostedCreature;
  monster?: BoostedCreature;
  error?: string;
}

interface RubinotBoostedApiCreature {
  id?: number | string;
  name?: string;
  looktype?: number | string;
  lookType?: number | string;
  lookTypeEx?: number | string;
  addons?: number | string;
  head?: number | string;
  body?: number | string;
  legs?: number | string;
  feet?: number | string;
  mount?: number | string;
  mountHead?: number | string;
  mountBody?: number | string;
  mountLegs?: number | string;
  mountFeet?: number | string;
}

interface RubinotBoostedApiPayload {
  boss?: RubinotBoostedApiCreature;
  monster?: RubinotBoostedApiCreature;
}

const RUBINOT_HOME_URL = "https://rubinot.net/";
const RUBINOT_FALLBACK_HOME_URL = "https://rubinot.com.br/";
const RUBINOT_BOOSTED_API_URL = "https://rubinot.net/api/boosted";
const RUBINOT_OUTFIT_URL = "https://rubinot.net/api/outfit";
const BOOSTED_BODY_CLASS = "BoostedBox-module__6IRxPW__body";

export async function handleBoostedRequest() {
  try {
    const payload = await fetchRubinotBoosted();
    return json(payload, 200, {
      ...corsHeaders(),
      "Cache-Control": "public, max-age=300"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar RubinOT.";
    return json(
      {
        sourceUrl: RUBINOT_HOME_URL,
        fetchedAt: new Date().toISOString(),
        error: message
      } satisfies BoostedPayload,
      502,
      {
        ...corsHeaders(),
        "Cache-Control": "no-store"
      }
    );
  }
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type, x-cron-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*"
  };
}

async function fetchRubinotBoosted(): Promise<BoostedPayload> {
  return fetchRubinotBoostedFallback();
}

async function fetchRubinotBoostedApi(): Promise<BoostedPayload> {
  const response = await fetch(RUBINOT_BOOSTED_API_URL, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      Referer: RUBINOT_HOME_URL,
      "User-Agent": "RubinotHelpBot/1.0 (+https://rubinot.net/)"
    }
  });

  if (!response.ok) {
    throw new Error(`RubinOT API respondeu HTTP ${response.status}.`);
  }

  const data = (await response.json()) as RubinotBoostedApiPayload;
  return {
    sourceUrl: RUBINOT_BOOSTED_API_URL,
    fetchedAt: new Date().toISOString(),
    boss: data.boss ? mapBoostedApiCreature("boss", data.boss) : undefined,
    monster: data.monster ? mapBoostedApiCreature("monster", data.monster) : undefined
  };
}

async function fetchRubinotBoostedFromHtml(sourceUrl: string): Promise<BoostedPayload> {
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "User-Agent": "RubinotHelpBot/1.0 (+https://rubinot.net/)"
    }
  });

  if (!response.ok) {
    throw new Error(`RubinOT respondeu HTTP ${response.status}.`);
  }

  const html = await readLimitedText(response);
  const entries = parseBoostedEntries(html);

  if (entries.length === 0) {
    throw new Error("Bloco de boosted diario nao encontrado.");
  }

  const boss = entries.find((entry) => entry.type === "boss") ?? entries[0];
  const monster =
    entries.find((entry) => entry.type === "monster" && entry !== boss) ??
    entries.find((entry) => entry !== boss);

  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    boss,
    monster
  };
}

function mapBoostedApiCreature(
  type: BoostedCreatureType,
  creature: RubinotBoostedApiCreature
): BoostedCreature {
  const name = `${creature.name ?? (type === "boss" ? "Boss boosted" : "Monstro boosted")}`.trim();
  return {
    type,
    label: type === "boss" ? "Boss" : "Monstro",
    name,
    imageUrl: buildOutfitImageUrl(creature),
    href: RUBINOT_HOME_URL
  };
}

function buildOutfitImageUrl(creature: RubinotBoostedApiCreature) {
  const params = new URLSearchParams({
    type: safeNumber(creature.looktype ?? creature.lookType, 128).toString(),
    head: safeNumber(creature.head, 0).toString(),
    body: safeNumber(creature.body, 0).toString(),
    legs: safeNumber(creature.legs, 0).toString(),
    feet: safeNumber(creature.feet, 0).toString(),
    addons: safeNumber(creature.addons, 0).toString(),
    direction: "3",
    animated: "0",
    walk: "0",
    size: "0"
  });

  const lookTypeEx = safeNumber(creature.lookTypeEx, 0);
  if (lookTypeEx > 0) {
    params.set("typeex", lookTypeEx.toString());
  }

  const mount = safeNumber(creature.mount, 0);
  if (mount > 0) {
    params.set("mount", mount.toString());
    params.set("mounthead", safeNumber(creature.mountHead, 0).toString());
    params.set("mountbody", safeNumber(creature.mountBody, 0).toString());
    params.set("mountlegs", safeNumber(creature.mountLegs, 0).toString());
    params.set("mountfeet", safeNumber(creature.mountFeet, 0).toString());
  }

  return `${RUBINOT_OUTFIT_URL}?${params.toString()}`;
}

function safeNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

async function readLimitedText(response: Response, limit = 1_500_000) {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new Error("Resposta do RubinOT passou do limite permitido.");
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function parseBoostedEntries(html: string): BoostedCreature[] {
  const entries: BoostedCreature[] = [];
  let cursor = 0;

  while (true) {
    const classIndex = html.indexOf(BOOSTED_BODY_CLASS, cursor);
    if (classIndex === -1) {
      break;
    }

    const start = Math.max(0, html.lastIndexOf("<", classIndex));
    const nextClassIndex = html.indexOf(BOOSTED_BODY_CLASS, classIndex + BOOSTED_BODY_CLASS.length);
    const end = nextClassIndex === -1 ? classIndex + 4500 : nextClassIndex;
    const fragment = html.slice(start, Math.min(html.length, end));
    const entry = parseBoostedEntry(fragment, entries.length);

    if (entry && !entries.some((item) => item.type === entry.type && item.name === entry.name)) {
      entries.push(entry);
    }

    cursor = classIndex + BOOSTED_BODY_CLASS.length;
  }

  return entries;
}

function parseBoostedEntry(fragment: string, index: number): BoostedCreature | null {
  const imgTag = fragment.match(/<img\b[^>]*>/i)?.[0] ?? "";
  const imageUrl = toAbsoluteUrl(
    getAttribute(imgTag, "src") ??
      getAttribute(imgTag, "data-src") ??
      getAttribute(imgTag, "srcset")?.split(/\s+/)[0]
  );
  const href = toAbsoluteUrl(getAttribute(fragment.match(/<a\b[^>]*>/i)?.[0] ?? "", "href"));
  const plainText = htmlToText(fragment);
  const type = detectBoostedType(plainText, index);
  const fallbackName =
    meaningfulTextParts(plainText).find((part) => !/boosted|di.rio|daily|boss|monstro|monster|creature/i.test(part)) ??
    (type === "boss" ? "Boss boosted" : "Monstro boosted");
  const name = cleanCreatureName(getAttribute(imgTag, "alt") ?? getAttribute(imgTag, "title") ?? fallbackName);

  if (!imageUrl && !name) {
    return null;
  }

  return {
    type,
    label: type === "boss" ? "Boss" : "Monstro",
    name: name || fallbackName,
    imageUrl: imageUrl || "",
    href
  };
}

function detectBoostedType(text: string, index: number): BoostedCreatureType {
  if (/boss/i.test(text)) {
    return "boss";
  }

  if (/monstro|monster|creature/i.test(text)) {
    return "monster";
  }

  return index === 0 ? "boss" : "monster";
}

function getAttribute(tag: string, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1].trim()) : undefined;
}

function toAbsoluteUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, RUBINOT_HOME_URL).href;
  } catch {
    try {
      return new URL(value, RUBINOT_FALLBACK_HOME_URL).href;
    } catch {
      return undefined;
    }
  }
}

async function fetchRubinotBoostedFallback(): Promise<BoostedPayload> {
  try {
    return await fetchRubinotBoostedApi();
  } catch {
    try {
      return await fetchRubinotBoostedFromHtml(RUBINOT_HOME_URL);
    } catch {
      return fetchRubinotBoostedFromHtml(RUBINOT_FALLBACK_HOME_URL);
    }
  }
}

function meaningfulTextParts(text: string) {
  return text
    .split(/\n| {2,}|[-|\u2022]/)
    .map((part) => cleanCreatureName(part))
    .filter((part) => part.length > 1);
}

function cleanCreatureName(value: string) {
  return decodeHtml(value)
    .replace(/\b(boosted|daily|di.rio|boss|monstro|monster|creature)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(html: string) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|span|strong|small|h1|h2|h3|a)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity: string) => entities[entity.toLowerCase()] ?? match);
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
