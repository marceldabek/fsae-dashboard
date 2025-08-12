
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { app } from "./firebase";
import { ADMIN_UID } from "./admin";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export function listenAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
export async function signIn() {
  const { user } = await signInWithPopup(auth, provider);
  return user;
}
export async function signOutUser() {
  await signOut(auth);
}

// Lightweight sync getters (no listeners) for current user/admin checks
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function isCurrentUserAdmin(): boolean {
  const u = auth.currentUser;
  return !!u && u.uid === ADMIN_UID;
}
