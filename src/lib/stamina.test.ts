import { describe, expect, it } from "vitest";
import {
  calculateStaminaProjection,
  formatStamina,
  GREEN_STAMINA_START,
  minutesToRecover,
  toStaminaMinutes
} from "./stamina";

describe("stamina calculator", () => {
  it("formats clamped stamina as HH:MM", () => {
    expect(formatStamina(toStaminaMinutes(42, 0))).toBe("42:00");
    expect(formatStamina(toStaminaMinutes(99, 0))).toBe("42:00");
    expect(formatStamina(toStaminaMinutes(13, 59))).toBe("13:59");
  });

  it("uses orange recovery before 39:00", () => {
    expect(minutesToRecover(toStaminaMinutes(38, 59), GREEN_STAMINA_START, "offline")).toBe(3);
    expect(minutesToRecover(toStaminaMinutes(13, 59), toStaminaMinutes(14, 0), "trainer")).toBe(6);
  });

  it("uses green recovery from 39:00 to 42:00", () => {
    expect(minutesToRecover(toStaminaMinutes(39, 0), toStaminaMinutes(42, 0), "offline")).toBe(
      18 * 60
    );
    expect(minutesToRecover(toStaminaMinutes(39, 0), toStaminaMinutes(42, 0), "protection")).toBe(
      15 * 60
    );
  });

  it("does not return negative recovery when target is already reached", () => {
    const projection = calculateStaminaProjection(toStaminaMinutes(40, 0), "green", "offline");
    expect(projection.recoveryMinutes).toBe(0);
    expect(projection.target).toBe(toStaminaMinutes(40, 0));
  });
});
