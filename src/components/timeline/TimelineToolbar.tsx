import React from 'react';

interface Props {
  mode: 'attached' | 'all';
  onModeChange: (m: 'attached' | 'all') => void;
}

export default function TimelineToolbar({ mode, onModeChange }: Props) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1">
        <span className="uppercase tracking-caps text-muted">Cards:</span>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            className={`px-2 py-1 ${mode === 'attached' ? 'bg-accent/20 text-accent font-semibold' : 'hover:bg-surface/50'}`}
            onClick={() => onModeChange('attached')}
          >Attached</button>
          <button
            className={`px-2 py-1 ${mode === 'all' ? 'bg-accent/20 text-accent font-semibold' : 'hover:bg-surface/50'}`}
            onClick={() => onModeChange('all')}
          >All Projects</button>
        </div>
      </div>
    </div>
  );
}
