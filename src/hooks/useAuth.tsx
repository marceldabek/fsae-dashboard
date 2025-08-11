
import { useEffect, useState } from "react";
import { listenAuth } from "../auth";
import type { User } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => listenAuth(setUser), []);
  return user;
}
