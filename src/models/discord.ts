export type DiscordRole = { id: string; name: string };

export type DiscordMember = {
  id: string;             // firestore doc id = discord user id
  uid: string;            // same as id
  displayName: string;
  nickname: string | null;
  username: string;
  globalName: string | null;
  avatarUrl?: string;
  roleIds: string[];
  roles: DiscordRole[];
};
