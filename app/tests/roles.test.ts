import { describe, expect, it } from "vitest";
import { POPULAR_ROLES, filterRoles } from "@/lib/roles";

describe("filterRoles", () => {
  it("returns the full popular list when the field is empty", () => {
    expect(filterRoles("")).toEqual(POPULAR_ROLES);
    expect(filterRoles("   ")).toEqual(POPULAR_ROLES);
  });

  it("narrows by label substring, case-insensitive", () => {
    const labels = filterRoles("back").map((r) => r.label);
    expect(labels).toContain("Backend Engineer");
    expect(labels).not.toContain("Product Designer");
    expect(filterRoles("DESIGNER").map((r) => r.label)).toContain("Product Designer");
  });

  it("matches aliases", () => {
    expect(filterRoles("pm").map((r) => r.label)).toContain("Product Manager");
    expect(filterRoles("ml").map((r) => r.label)).toContain("Machine Learning Engineer");
    expect(filterRoles("sre").map((r) => r.label)).toContain("DevOps Engineer");
  });

  it("returns nothing when nothing fits (caller offers custom entry)", () => {
    expect(filterRoles("astronaut")).toEqual([]);
  });
});
