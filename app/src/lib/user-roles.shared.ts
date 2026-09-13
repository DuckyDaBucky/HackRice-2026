export type AppUserRole = "candidate" | "developer" | "hr";

export function roleLabel(role: AppUserRole) {
  if (role === "developer") return "Developer";
  if (role === "hr") return "HR";
  return "Candidate";
}

export function roleHasHrAccess(role: AppUserRole) {
  return role === "developer" || role === "hr";
}
