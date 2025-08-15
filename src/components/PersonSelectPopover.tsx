import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import type { Person } from "../types";

// Standardized person selection popover component (single or multi select)
// Appears centered and limited to maxItems (default 8) to avoid internal scrolling.

export interface PersonSelectPopoverProps {
	people: Person[];
	mode?: "single" | "multi";
	selectedId?: string | null; // single
	selectedIds?: string[]; // multi
	onSelect?: (id: string | null) => void; // single
	onAdd?: (id: string) => void; // multi
	onRemove?: (id: string) => void; // multi
	triggerLabel?: string; // custom button label override
	triggerContent?: ReactNode; // full custom trigger node (icon etc.)
	buttonClassName?: string;
	disabled?: boolean;
	maxItems?: number; // limit results shown (no scrolling design goal)
	allowUnassign?: boolean; // single mode only
	allowScroll?: boolean; // allow scrolling inside the popover list
}

export default function PersonSelectPopover(props: PersonSelectPopoverProps) {
	const {
		people,
		mode = "single",
		selectedId = null,
		selectedIds = [],
		onSelect,
		onAdd,
		onRemove,
		triggerLabel,
		triggerContent,
		buttonClassName = "px-3 py-2 rounded bg-white/10 border border-white/20 text-sm hover:bg-white/15 transition",
		disabled = false,
		maxItems = 8,
		allowUnassign = true,
		allowScroll = false,
	} = props;

	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (!open) return;
		function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
		window.addEventListener("mousedown", handle);
		return () => window.removeEventListener("mousedown", handle);
	}, [open]);

	const filtered = useMemo(() => {
		const qq = q.toLowerCase();
		return people.filter(p => !qq || p.name.toLowerCase().includes(qq) || (p.skills || []).join(" ").toLowerCase().includes(qq));
	}, [people, q]);

	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

	const autoLabel = (() => {
		if (triggerLabel) return triggerLabel;
		if (mode === "single") {
			if (selectedId) {
				const p = people.find(pp => pp.id === selectedId);
				return p ? p.name : "Assign to…";
			}
			return "Assign to…";
		}
		if (selectedIds.length === 0) return "Add/Remove";
		if (selectedIds.length === 1) {
			const p = people.find(pp => pp.id === selectedIds[0]);
			return p ? p.name : "1 selected";
		}
		return `${selectedIds.length} selected`;
	})();

	return (
		<>
			<button type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)} className={`${buttonClassName} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} aria-label={typeof triggerContent !== 'undefined' ? (triggerLabel || 'Open selector') : undefined}>
				{triggerContent ?? autoLabel}
			</button>
			{open && (
				<div className="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
					<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
					<div ref={ref} className="relative z-10 w-full max-w-md rounded-lg border border-white/15 bg-black/80 p-3 space-y-2">
						<div className="flex items-center gap-2">
							<input
								autoFocus
								value={q}
								onChange={e => setQ(e.target.value)}
								placeholder="Search people…"
								className="w-full px-2 py-1.5 rounded bg-white/10 text-sm focus:outline-none"
							/>
							<button onClick={() => setOpen(false)} className="text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15">Close</button>
						</div>
						<ul className={`space-y-1 text-sm ${allowScroll ? 'max-h-60 overflow-auto' : ''}`}>
							{mode === "single" && allowUnassign && (
								<li>
									<button
										className={`w-full text-left px-2 py-1 rounded hover:bg-white/5 text-[13px] ${!selectedId ? 'bg-white/10' : ''}`}
										onClick={() => { onSelect?.(null); setOpen(false); }}
									>Unassigned</button>
								</li>
							)}
							{filtered.slice(0, maxItems).map(p => {
								const selected = mode === "single" ? p.id === selectedId : selectedSet.has(p.id);
								return (
									<li key={p.id} className="flex items-center gap-2 justify-between px-2 py-1 rounded hover:bg-white/5">
										<div className="min-w-0">
											<div className="truncate text-sm font-medium">{p.name}</div>
											{p.skills && p.skills.length > 0 && (<div className="text-xs text-muted truncate uppercase tracking-caps">{p.skills.join(', ')}</div>)}
										</div>
										{mode === "multi" ? (
											<button
												onClick={() => selected ? onRemove?.(p.id) : onAdd?.(p.id)}
												className={`px-2 py-1 rounded text-tick border ${selected ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-overlay-6 border-overlay-10 hover:bg-overlay-10/60'}`}
											>{selected ? 'Remove' : 'Add'}</button>
										) : (
											<button
												onClick={() => { onSelect?.(p.id); setOpen(false); }}
												className={`px-2 py-1 rounded text-tick border ${selected ? 'bg-accent/30 border-accent/50 text-accent' : 'bg-overlay-6 border-overlay-10 hover:bg-overlay-10/60'}`}
											>{selected ? 'Selected' : 'Select'}</button>
										)}
									</li>
								);
							})}
							{filtered.slice(0, maxItems).length === 0 && (
								<li className="text-xs text-muted px-2 py-1 uppercase tracking-caps">No people</li>
							)}
							{filtered.length > maxItems && (
								<li className="text-tick text-muted px-2 py-1">Showing first {maxItems} results… refine search</li>
							)}
						</ul>
					</div>
				</div>
			)}
		</>
	);
}
