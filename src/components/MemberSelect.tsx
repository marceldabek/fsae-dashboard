import { useMemo } from 'react';
import { useDiscordMembers } from '@/hooks/useDiscordMembers';
import type { DiscordMember } from '@/models/discord';

type Props = {
  value?: string;
  onChange?: (member: Pick<DiscordMember, 'id' | 'displayName' | 'avatarUrl' | 'roleIds' | 'roles'>) => void;
  filterRoleIds?: string[]; // optional role gating
  className?: string;
};

export default function MemberSelect({ value, onChange, filterRoleIds, className }: Props) {
  const { members, loading } = useDiscordMembers();

  const filtered = useMemo(() => {
    if (!filterRoleIds || !filterRoleIds.length) return members;
    const set = new Set(filterRoleIds);
    return members.filter(m => m.roleIds.some(r => set.has(r)));
  }, [members, filterRoleIds]);

  if (loading) return <div className={className}>Loading members…</div>;

  return (
    <select
      className={"border rounded px-3 py-2 w-full " + (className || '')}
      value={value ?? ''}
      onChange={(e) => {
        const m = filtered.find(x => x.id === e.target.value);
        if (m) onChange?.({ id: m.id, displayName: m.displayName, avatarUrl: m.avatarUrl, roleIds: m.roleIds, roles: m.roles });
      }}
    >
      <option value="" disabled>Select member…</option>
      {filtered.map(m => (
        <option key={m.id} value={m.id}>
          {m.displayName}{m.nickname ? ` (${m.nickname})` : ''}
        </option>
      ))}
    </select>
  );
}
