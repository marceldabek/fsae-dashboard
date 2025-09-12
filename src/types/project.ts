export type ID = string;

export interface Project {
  id: ID;
  name: string;
  color?: string;
  status?: "planned" | "active" | "blocked" | "done";
  ownerId?: string;
}

export interface Timeline {
  id: ID;
  name: string;
  start?: number; // optional visible window
  end?: number;
}

export interface Attachment {
  id: ID;
  timelineId: ID;
  projectId: ID;
  start: number;  // ms
  end: number;    // ms
}

export interface Dependency {
  id: ID;
  fromAttachmentId: ID;
  toAttachmentId: ID;
  type?: "fs" | "ss" | "ff" | "sf"; // default fs
}
