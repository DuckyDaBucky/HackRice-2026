import { describe, expect, it } from "vitest";
import { canSwitchDashboardView, resolveDashboardView } from "@/lib/dashboard/view-mode";

describe("resolveDashboardView", () => {
  it("locks candidates to practice", () => {
    expect(resolveDashboardView("candidate", "hr")).toBe("practice");
  });

  it("locks HR users to the HR dashboard", () => {
    expect(resolveDashboardView("hr", "practice")).toBe("hr");
  });

  it("lets developers choose via cookie", () => {
    expect(resolveDashboardView("developer", undefined)).toBe("practice");
    expect(resolveDashboardView("developer", "hr")).toBe("hr");
    expect(resolveDashboardView("developer", "practice")).toBe("practice");
  });
});

describe("canSwitchDashboardView", () => {
  it("is only true for developers", () => {
    expect(canSwitchDashboardView("developer")).toBe(true);
    expect(canSwitchDashboardView("candidate")).toBe(false);
    expect(canSwitchDashboardView("hr")).toBe(false);
  });
});
