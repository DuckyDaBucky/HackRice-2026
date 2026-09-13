export interface RoleOption {
  label: string;
  aliases: string[];
}

/** Curated popular roles shown when the field is empty. Free text is always allowed. */
export const POPULAR_ROLES: RoleOption[] = [
  { label: "Software Engineer", aliases: ["swe", "developer", "software developer", "programmer"] },
  { label: "Backend Engineer", aliases: ["backend", "server", "api engineer"] },
  { label: "Frontend Engineer", aliases: ["frontend", "front end", "ui engineer", "web developer"] },
  { label: "Full-Stack Engineer", aliases: ["fullstack", "full stack", "generalist"] },
  { label: "Machine Learning Engineer", aliases: ["ml", "ai engineer", "ml engineer", "artificial intelligence"] },
  { label: "Data Scientist", aliases: ["data science", "ds", "analyst", "analytics"] },
  { label: "Data Engineer", aliases: ["data eng", "pipeline", "etl"] },
  { label: "DevOps Engineer", aliases: ["devops", "sre", "site reliability", "infrastructure", "platform engineer"] },
  { label: "iOS Developer", aliases: ["ios", "swift", "mobile", "apple"] },
  { label: "Android Developer", aliases: ["android", "kotlin", "mobile"] },
  { label: "Product Manager", aliases: ["pm", "product"] },
  { label: "Product Designer", aliases: ["designer", "ux", "ui designer", "product design"] },
];

/** Empty query returns everything (popular list). Otherwise substring-match on label + aliases. */
export function filterRoles(query: string, roles: RoleOption[] = POPULAR_ROLES): RoleOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return roles;
  return roles.filter(
    (role) =>
      role.label.toLowerCase().includes(q) ||
      role.aliases.some((alias) => alias.toLowerCase().includes(q)),
  );
}
