
import { useEffect, useState } from "react";
import { listenAuth } from "../auth";
import type { User } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    return listenAuth(u => {
      setUser(u);
    });
  }, []);
  return user;
}
