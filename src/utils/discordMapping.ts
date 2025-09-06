import type { DiscordMember } from '@/models/discord';
import type { Person } from '@/types';

export function discordMembersToPersons(members: DiscordMember[]): Person[] {
  return members.map(m => ({
    id: m.id,
    name: m.displayName,
    discord: m.username ? `@${m.username}` : undefined,
  } as Person));
}
