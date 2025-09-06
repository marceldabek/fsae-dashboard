
export type RankLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export type Person = {
  id: string;
  name: string;
  year?: string;
  skills?: string[];
  role?: string;
  discord?: string; // @username
  avatar_url?: string; // preferred avatar image URL (e.g., discordGuilds.members.avatarUrl)
  // Ranked mode fields
  rank?: RankLevel; // defaults to Bronze if undefined
  ranked_opt_in?: boolean; // participates in the weekly/hourly pool
  // History of rank changes (newest last)
  rank_history?: { ts: number; from: RankLevel; to: RankLevel }[];
};

export type Project = {
  id: string;
  name: string;
  owner_ids?: string[];
  design_link?: string;
  description?: string;
  due_date?: string;
  // Subsystem this project belongs to (e.g. "Aero", "Business", etc.)
  subsystem?: string;
  archived?: boolean; // soft-archive flag
  created_at?: number; // timestamp for when the project was created
};

export type Task = {
  id: string;
  project_id: string;
  description: string;
  status: "In Progress" | "Complete" | "Todo";
  assignee_id?: string; // Person.id of the assignee
  // Timestamps (ms since epoch) for basic analytics; optional for legacy tasks
  created_at?: number;
  completed_at?: number;
  // Optional ranked scoring override for this task (default handled in app logic)
  ranked_points?: number; // points can be any positive integer based on admin-defined scale
};

// Optional dependency between projects (stored in Firestore: project_deps)
export type ProjectDependency = {
  id: string;
  from_id: string; // prerequisite project (edge starts here)
  to_id: string;   // dependent project (edge ends here)
};

// Settings for Ranked mode (stored in Firestore: settings/ranked)
export type RankedSettings = {
  enabled?: boolean; // master toggle
  autoApply?: boolean; // automatically apply promotions/demotions on schedule
  applyEvery?: "hourly" | "weekly"; // currently use "hourly" per request
  last_reset_at?: number; // ms since epoch of last applied period end
  // Promotion percentages (top X% of rank move up at reset)
  promotion_pct?: {
    bronze?: number; // 0-100
    silver?: number;
    gold?: number;
    platinum?: number;
    diamond?: number; // generally 0 (no promotion from Diamond)
  };
  // Demotion percentages (bottom Y% of rank move down at reset)
  demotion_pct?: {
    bronze?: number; // generally 0 (no demotion from Bronze)
    silver?: number;
    gold?: number;
    platinum?: number;
    diamond?: number;
  };
  // Default points when a task has no ranked_points set
  default_task_points?: 10 | 35 | 100 | number;
};

// Simple attendance record
export type Attendance = {
  id: string;
  person_id: string;
  date: string; // YYYY-MM-DD (local date)
  points: number; // points awarded for attendance
  created_at?: number;
};

// Lightweight audit log for ranked-related actions
export type LogEvent = {
  id: string;
  ts: number; // timestamp (ms)
  type: "attendance" | "rank_change" | "rank_apply" | "task_points" | string; // add more as needed
  person_id?: string; // subject of the event (if any)
  points?: number; // points affected (if any)
  from_rank?: RankLevel;
  to_rank?: RankLevel;
  actor_uid?: string; // admin user who triggered the event (if available)
  note?: string; // optional human-readable note
};

// Lightweight daily analytics doc (anonymous). Stored at collection: analytics_daily/{YYYY-MM-DD}
export type DailyAnalytics = {
  date: string; // YYYY-MM-DD
  visits?: number; // total visits (deduped by client heuristic)
};
