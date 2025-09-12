import React, { useEffect, useState, useCallback } from 'react';
import { ID, Project, Attachment } from '@/types/project';
import { listUnattachedProjects, attachProjectToTimeline, detachAttachment, listAttachmentsForTimeline } from '@/data/attachments';

interface Props {
  timelineId: ID;
  projects: Project[]; // source list
  onAttached?: (a: Attachment) => void;
  onDetached?: (id: ID) => void;
}

export default function AttachPanel({ timelineId, projects, onAttached, onDetached }: Props) {
  const [unattached, setUnattached] = useState<Project[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const [ua, atts] = await Promise.all([
      listUnattachedProjects(timelineId, projects),
      listAttachmentsForTimeline(timelineId),
    ]);
    setUnattached(ua);
    setAttachments(atts);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [projects, timelineId]);

  const handleAttach = useCallback(async (p: Project) => {
    // Default one-week span from now
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const a = await attachProjectToTimeline(timelineId, p.id, now, now + week);
    onAttached?.(a);
    await refresh();
  }, [timelineId, onAttached]);

  const handleDetach = useCallback(async (id: ID) => {
    await detachAttachment(id);
    onDetached?.(id);
    await refresh();
  }, [onDetached]);

  if (loading) return <div className="text-xs text-muted p-2">Loading…</div>;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-caps mb-1">Unattached</h3>
        {unattached.length === 0 && <div className="text-[11px] text-muted">All projects attached</div>}
        <ul className="space-y-1">
          {unattached.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-surface/40 border border-border">
              <span className="truncate" title={p.name}>{p.name}</span>
              <button
                onClick={() => handleAttach(p)}
                className="px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/30 text-accent text-[11px]"
              >Attach</button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-caps mb-1">Attached</h3>
        {attachments.length === 0 && <div className="text-[11px] text-muted">None</div>}
        <ul className="space-y-1">
          {attachments.map(a => {
            const proj = projects.find(p => p.id === a.projectId);
            return (
              <li key={a.id} className="group flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-card/40 border border-border">
                <span className="truncate" title={proj?.name}>{proj?.name || a.projectId}</span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => handleDetach(a.id)}
                    className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px]"
                  >Detach</button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
