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

export const RUBINOT_SITE_URL = "https://rubinot.com.br/";
export const RUBINOT_WIKI_URL = "https://wiki.rubinot.com/pt-BR";

function boostedEndpoints() {
  const configured = import.meta.env.VITE_RUBINOT_BOOSTED_ENDPOINT?.trim();
  return configured ? [configured, "/rubinot/boosted"] : ["/rubinot/boosted"];
}

export async function fetchBoostedCreatures(signal?: AbortSignal): Promise<BoostedPayload> {
  const endpoints = boostedEndpoints();
  let lastError = "Endpoint do boosted diario nao configurado.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json"
        },
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Resposta nao veio em JSON.");
      }

      return (await response.json()) as BoostedPayload;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      lastError = error instanceof Error ? error.message : "Falha desconhecida.";
    }
  }

  return {
    sourceUrl: RUBINOT_SITE_URL,
    fetchedAt: new Date().toISOString(),
    error: lastError
  };
}
