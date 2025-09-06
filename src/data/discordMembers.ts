import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DiscordMember } from '@/models/discord';

const GUILD = import.meta.env.VITE_DISCORD_GUILD_ID as string;

export function listenDiscordMembers(cb: (members: DiscordMember[]) => void) {
  if (!GUILD) throw new Error('VITE_DISCORD_GUILD_ID is not set');
  const col = collection(db, 'discordGuilds', GUILD, 'members');
  const q = query(col, orderBy('displayName'), limit(2000)); // safety limit

  return onSnapshot(q, (snap) => {
    const members: DiscordMember[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        uid: data.uid ?? d.id,
        displayName: data.displayName ?? data.globalName ?? data.username ?? d.id,
        nickname: data.nickname ?? null,
        username: data.username ?? '',
        globalName: data.globalName ?? null,
        avatarUrl: data.avatarUrl,
        roleIds: Array.isArray(data.roleIds) ? data.roleIds : (data.roles?.map((r:any)=>r.id) ?? []),
        roles: data.roles ?? []
      } as DiscordMember;
    });
    cb(members);
  });
}
