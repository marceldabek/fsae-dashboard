import React, { useState, useMemo } from 'react';
import EdgesLayer from '../EdgesLayer';
import { Attachment, Dependency, Project } from '@/types/project';
import { useTimelineLayout } from '@/hooks/useTimelineLayout';
import ProjectCard from '../overview/OverviewProjectCard';

export interface TimelineProps {
  attachments: Attachment[];
  dependencies: Dependency[];
  projects: Project[]; // project meta to render inside cards
  scaleX: (t: number) => number;
  attachmentProject: (attachmentId: string) => Project | undefined;
}

export default function Timeline({ attachments, dependencies, projects, scaleX, attachmentProject }: TimelineProps) {
  const [hoveredAttachmentId, setHoveredAttachmentId] = useState<string | null>(null);

  const layout = useTimelineLayout(attachments, { scaleX });

  const neighborIds = useMemo(() => {
    if (!hoveredAttachmentId) return new Set<string>();
    const set = new Set<string>();
    set.add(hoveredAttachmentId);
    for (const d of dependencies) {
      if (d.fromAttachmentId === hoveredAttachmentId) set.add(d.toAttachmentId);
      if (d.toAttachmentId === hoveredAttachmentId) set.add(d.fromAttachmentId);
    }
    return set;
  }, [hoveredAttachmentId, dependencies]);

  return (
    <div className="relative">
      <EdgesLayer
        deps={dependencies}
        rectOf={layout.rectOf}
        hoveredAttachmentId={hoveredAttachmentId}
      />
      {attachments.map(a => {
        const rect = layout.rectOf(a.id)!;
        const project = attachmentProject(a.id);
        if (!project) return null;
        const dimmed = hoveredAttachmentId ? !neighborIds.has(a.id) : false;
        return (
          <div key={a.id} style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w }}>
            <ProjectCard
              project={project as any}
              owners={[]}
              tasks={[]}
              compact
              onHover={setHoveredAttachmentId}
              attachmentId={a.id}
              dimmed={dimmed}
            />
          </div>
        );
      })}
    </div>
  );
}
