export const MAX_STAMINA_MINUTES = 42 * 60;
export const GREEN_STAMINA_START = 39 * 60;
export const NORMAL_STAMINA_START = 14 * 60;
export const NO_LOOT_START = 8 * 60;

export type RegenMode = "offline" | "trainer" | "protection";

export interface RegenRate {
  label: string;
  orangeMinutesPerStamina: number;
  greenMinutesPerStamina: number;
}

export const REGEN_RATES: Record<RegenMode, RegenRate> = {
  offline: {
    label: "Offline ou sleeping",
    orangeMinutesPerStamina: 3,
    greenMinutesPerStamina: 6
  },
  trainer: {
    label: "Trainer",
    orangeMinutesPerStamina: 6,
    greenMinutesPerStamina: 6
  },
  protection: {
    label: "Protection zone",
    orangeMinutesPerStamina: 3,
    greenMinutesPerStamina: 5
  }
};

export type StaminaTarget = "green" | "full" | "normal" | "loot";

export const STAMINA_TARGETS: Record<StaminaTarget, { label: string; minutes: number }> = {
  green: { label: "Green 39:00", minutes: GREEN_STAMINA_START },
  full: { label: "Full 42:00", minutes: MAX_STAMINA_MINUTES },
  normal: { label: "Normal 14:00", minutes: NORMAL_STAMINA_START },
  loot: { label: "Loot 08:00", minutes: NO_LOOT_START }
};

export function clampStamina(minutes: number) {
  return Math.min(MAX_STAMINA_MINUTES, Math.max(0, Math.floor(minutes)));
}

export function toStaminaMinutes(hours: number, minutes: number) {
  return clampStamina(hours * 60 + minutes);
}

export function formatStamina(totalMinutes: number) {
  const stamina = clampStamina(totalMinutes);
  const hours = Math.floor(stamina / 60).toString().padStart(2, "0");
  const minutes = (stamina % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getStaminaBand(totalMinutes: number) {
  const stamina = clampStamina(totalMinutes);

  if (stamina >= GREEN_STAMINA_START) {
    return {
      label: "Green",
      effect: "Bonus EXP +50% do rate",
      tone: "success" as const
    };
  }

  if (stamina >= NORMAL_STAMINA_START) {
    return {
      label: "Orange",
      effect: "EXP normal",
      tone: "info" as const
    };
  }

  if (stamina >= NO_LOOT_START) {
    return {
      label: "Red",
      effect: "EXP reduzida -50%",
      tone: "warning" as const
    };
  }

  return {
    label: "Sem loot",
    effect: "EXP reduzida e criaturas sem loot",
    tone: "danger" as const
  };
}

export function minutesToRecover(
  currentMinutes: number,
  targetMinutes: number,
  mode: RegenMode
) {
  const current = clampStamina(currentMinutes);
  const target = clampStamina(targetMinutes);
  const rate = REGEN_RATES[mode];

  if (current >= target) {
    return 0;
  }

  let realMinutes = 0;
  for (let staminaMinute = current; staminaMinute < target; staminaMinute += 1) {
    realMinutes +=
      staminaMinute >= GREEN_STAMINA_START
        ? rate.greenMinutesPerStamina
        : rate.orangeMinutesPerStamina;
  }

  return realMinutes;
}

export function calculateStaminaProjection(
  currentMinutes: number,
  target: StaminaTarget,
  mode: RegenMode,
  from = new Date()
) {
  const targetMinutes = Math.max(currentMinutes, STAMINA_TARGETS[target].minutes);
  const recoveryMinutes = minutesToRecover(currentMinutes, targetMinutes, mode);
  const readyAt = new Date(from.getTime() + recoveryMinutes * 60_000);

  return {
    current: clampStamina(currentMinutes),
    target: targetMinutes,
    recoveryMinutes,
    readyAt,
    band: getStaminaBand(currentMinutes)
  };
}
