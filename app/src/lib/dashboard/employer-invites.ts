/**
 * Employer-sent interview invites (docs/03-corporate-experience.md) have no
 * backend yet — no invite table, no employer workspace. This is a fixed
 * illustrative sample so the candidate dashboard's "employer interview" UI
 * can be reviewed before that backend exists. Replace with a real query once
 * invites are stored.
 */
export interface EmployerInvite {
  id: string;
  role: string;
  company: string;
  stage: string;
  dueDate: string;
  durationMinutes: number;
}

export const SAMPLE_EMPLOYER_INVITES: EmployerInvite[] = [
  {
    id: "sample-invite-1",
    role: "Software Engineer",
    company: "Acme",
    stage: "First-round interview",
    dueDate: "Sep 14",
    durationMinutes: 25,
  },
];
