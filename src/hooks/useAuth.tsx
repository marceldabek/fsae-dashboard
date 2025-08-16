
import { useEffect, useState } from "react";
import { listenAuth } from "../auth";
import type { User } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    return listenAuth(u => {
      // Lightweight debug log (can remove later)
      console.log('[auth] state change', u ? u.uid : 'null');
      setUser(u);
    });
  }, []);
  return user;
}
