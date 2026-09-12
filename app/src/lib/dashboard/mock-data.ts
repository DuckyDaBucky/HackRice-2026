import type { SessionRecord, SessionStats } from "@/lib/sessions";
import type { Resume } from "@/lib/workbench/schemas";

/**
 * TEMPORARY — per explicit request, so the redesigned dashboard can be
 * reviewed fully populated before real usage data (or a working resume
 * upload) exists. Flip this back to false once there's real activity to
 * show, or before any real user relies on this account.
 */
export const USE_MOCK_DASHBOARD_DATA = true;

function daysAgo(n: number, hour = 14): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function minutesAfter(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export const MOCK_STATS: SessionStats = {
  totalSessions: 8,
  completedSessions: 6,
  last7Days: 3,
};

const s = (
  id: string,
  mode: SessionRecord["mode"],
  status: SessionRecord["status"],
  age: number,
  minutes: number | null,
  questionCount: number,
  mood: SessionRecord["mood"],
): SessionRecord => {
  const createdAt = daysAgo(age);
  return {
    id,
    mode,
    status,
    createdAt,
    completedAt: status === "completed" && minutes ? minutesAfter(createdAt, minutes) : null,
    questionCount,
    mood,
    customPrompt: null,
    voiceId: null,
  };
};

export const MOCK_SESSIONS: SessionRecord[] = [
  s("mock-tech-1", "technical", "completed", 0, 24, 5, "neutral"),
  s("mock-behav-1", "behavioral", "completed", 2, 31, 4, "supportive"),
  s("mock-tech-2", "technical", "completed", 4, 22, 5, "challenging"),
  s("mock-behav-2", "behavioral", "in_progress", 5, null, 4, "neutral"),
  s("mock-tech-3", "technical", "completed", 7, 27, 6, "neutral"),
  s("mock-behav-3", "behavioral", "completed", 9, 29, 4, "supportive"),
  s("mock-tech-4", "technical", "abandoned", 11, null, 5, "challenging"),
  s("mock-behav-4", "behavioral", "completed", 14, 33, 4, "neutral"),
];

export const MOCK_HAS_RESUME = true;

const MOCK_RESUME: Resume = {
  experienceLevel: "entry",
  experienceReason: "Mock profile for design review.",
  skills: ["Python", "Java", "SQL", "React", "Next.js"],
  warnings: [],
  sections: [
    {
      kind: "education",
      title: "B.S. in Computer Science",
      organization: "Rice University",
      dates: "2023 – 2027",
      evidence: [],
    },
    {
      kind: "internships",
      title: "Software Engineering Intern",
      organization: "Acme Corp",
      dates: "Summer 2025",
      evidence: [],
    },
  ],
  projects: [
    {
      id: "mock-project-1",
      name: "GetMeHired",
      description: "Interview practice platform with resume-personalized questions.",
      skills: ["Next.js", "Postgres"],
      competencies: [],
      contribution: null,
      decisions: [],
      outcomes: [],
      evidence: [],
    },
    {
      id: "mock-project-2",
      name: "Course Scheduler",
      description: "Tool for planning degree-plan course sequences under prerequisite constraints.",
      skills: ["Python"],
      competencies: [],
      contribution: null,
      decisions: [],
      outcomes: [],
      evidence: [],
    },
  ],
};

export const MOCK_PROFILE_ACCOUNT = {
  profile: MOCK_RESUME,
  version: 1,
  updatedAt: daysAgo(1),
  classifiedAt: daysAgo(1),
};
