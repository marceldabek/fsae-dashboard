import { useEffect, useState } from 'react';
import { listenDiscordMembers } from '@/data/discordMembers';
import type { DiscordMember } from '@/models/discord';

export function useDiscordMembers() {
  const [members, setMembers] = useState<DiscordMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenDiscordMembers((m) => {
      setMembers(m);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { members, loading };
}
