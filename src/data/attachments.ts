import { ID, Project, Attachment } from '@/types/project';

// In-memory store for demo; replace with Firestore integration later.
const attachmentsStore: Attachment[] = [];

// Helper to generate ids
function genId() { return Math.random().toString(36).slice(2, 10); }

export async function listAttachmentsForTimeline(timelineId: ID): Promise<Attachment[]> {
  return attachmentsStore.filter(a => a.timelineId === timelineId);
}

export async function listUnattachedProjects(timelineId: ID, projects?: Project[]): Promise<Project[]> {
  // If caller supplies projects list, use it; else expect them to filter externally.
  // Return projects that do not have an attachment on this timeline.
  const attached = new Set(
    attachmentsStore.filter(a => a.timelineId === timelineId).map(a => a.projectId)
  );
  const src = projects || [];
  return src.filter(p => !attached.has(p.id));
}

export async function attachProjectToTimeline(
  timelineId: ID,
  projectId: ID,
  start: number,
  end: number
): Promise<Attachment> {
  const existing = attachmentsStore.find(a => a.timelineId === timelineId && a.projectId === projectId);
  if (existing) return existing; // idempotent attach per timeline
  const att: Attachment = { id: genId(), timelineId, projectId, start, end };
  attachmentsStore.push(att);
  return att;
}

export async function detachAttachment(attachmentId: ID): Promise<void> {
  const idx = attachmentsStore.findIndex(a => a.id === attachmentId);
  if (idx >= 0) attachmentsStore.splice(idx, 1);
}
