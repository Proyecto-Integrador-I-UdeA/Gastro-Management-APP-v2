import { describe, expect, it } from "vitest";
import { getKitchenTimer } from "@/utils/kitchenTimer";

const now = Date.parse("2026-09-09T12:00:00.000Z");

describe("temporizador de cocina", () => {
  it("clasifica un tiempo normal", () => {
    expect(getKitchenTimer("2026-09-09T12:10:00.000Z", 5, now)).toEqual({
      state: "normal",
      label: "10:00",
    });
  });

  it("activa advertencia cuando quedan cinco minutos o menos", () => {
    expect(getKitchenTimer("2026-09-09T12:05:00.000Z", 5, now)).toEqual({
      state: "warning",
      label: "05:00",
    });
  });

  it("informa retraso cuando se supera el objetivo", () => {
    expect(getKitchenTimer("2026-09-09T11:58:30.000Z", 5, now)).toEqual({
      state: "overdue",
      label: "Retraso 01:30",
    });
  });
});
