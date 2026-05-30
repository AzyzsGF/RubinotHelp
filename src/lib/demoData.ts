import { BossRecord } from "../types";
import { createId, nowIso } from "./time";

export const HERO_IMAGE = "/rubinot-cave-background.jpg";

export function createDemoBosses(): BossRecord[] {
  const created = nowIso();

  return [
    {
      id: createId("boss"),
      name: "Ancient Scarab King",
      full_name: "Ancient Scarab King",
      popular_name: "Scarab King",
      display_name_mode: "full",
      type: "boss",
      image_url: HERO_IMAGE,
      hp: 185000,
      mana: 0,
      weaknesses: ["Gelo", "Sagrado"],
      damage_types: ["Terra", "Físico"],
      mechanics:
        "Invoca ondas de scarabs, troca de alvo em área curta e pune jogadores parados no centro.",
      access_notes: "Acesso por tumba profunda; recomendado entrar com supplies para sustain longo.",
      requires_access: true,
      access_url: "https://rubinot.com.br/serverinfo",
      location: "Tumba profunda, rota leste do deserto.",
      location_url: "https://rubinot.com.br/serverinfo",
      recommended_equipment:
        "Proteção de terra, set com defesa física alta, runas de área e imbuements defensivos.",
      cooldown_minutes: 20 * 60,
      youtube_url: "",
      is_active: true,
      steps: [
        {
          id: createId("step"),
          sort_order: 0,
          name: "Entrada da tumba",
          image_url: HERO_IMAGE,
          location: "Descer pela rota principal da tumba.",
          mechanics: "Limpar as waves antes de puxar o boss para evitar stack de summons."
        },
        {
          id: createId("step"),
          sort_order: 1,
          name: "Ancient Scarab King",
          image_url: HERO_IMAGE,
          location: "Sala final.",
          mechanics: "Manter distância das explosões centrais e trocar de alvo nos summons."
        }
      ],
      created_at: created,
      updated_at: created
    },
    {
      id: createId("boss"),
      name: "Frost Herald",
      full_name: "Frost Herald",
      popular_name: "Herald",
      display_name_mode: "full",
      type: "mini-boss",
      image_url: HERO_IMAGE,
      hp: 72000,
      mana: 0,
      weaknesses: ["Fogo", "Energia"],
      damage_types: ["Gelo", "Morte"],
      mechanics: "Marca um jogador e explode a marca depois de alguns segundos.",
      access_notes: "Mini boss de rota gelada, ideal checar depois do server save.",
      requires_access: false,
      access_url: "",
      location: "Rota gelada, corredor norte.",
      location_url: "",
      recommended_equipment: "Proteção de gelo, might rings e dano de fogo para acelerar a luta.",
      cooldown_minutes: 8 * 60,
      youtube_url: "",
      is_active: true,
      steps: [],
      created_at: created,
      updated_at: created
    }
  ];
}
