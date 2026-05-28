import { BossRecord } from "../types";
import { createId, nowIso } from "./time";

export const HERO_IMAGE = "/rubinot-cave-banner.jpg";

export function createDemoBosses(): BossRecord[] {
  const created = nowIso();

  return [
    {
      id: createId("boss"),
      name: "Ancient Scarab King",
      type: "boss",
      image_url: HERO_IMAGE,
      hp: 185000,
      mana: 0,
      weaknesses: ["Gelo", "Sagrado"],
      damage_types: ["Terra", "Físico"],
      mechanics:
        "Invoca ondas de scarabs, troca de alvo em área curta e pune jogadores parados no centro.",
      access_notes: "Acesso por tumba profunda; recomendado entrar com supplies para sustain longo.",
      recommended_equipment:
        "Proteção de terra, set com defesa física alta, runas de área e imbuements defensivos.",
      cooldown_minutes: 20 * 60,
      youtube_url: "",
      is_active: true,
      created_at: created,
      updated_at: created
    },
    {
      id: createId("boss"),
      name: "Frost Herald",
      type: "mini-boss",
      image_url: HERO_IMAGE,
      hp: 72000,
      mana: 0,
      weaknesses: ["Fogo", "Energia"],
      damage_types: ["Gelo", "Morte"],
      mechanics: "Marca um jogador e explode a marca depois de alguns segundos.",
      access_notes: "Mini boss de rota gelada, ideal checar depois do server save.",
      recommended_equipment: "Proteção de gelo, might rings e dano de fogo para acelerar a luta.",
      cooldown_minutes: 8 * 60,
      youtube_url: "",
      is_active: true,
      created_at: created,
      updated_at: created
    }
  ];
}
