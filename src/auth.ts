
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { app } from "./firebase";
import { isAdminUid } from "./admin";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export function listenAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
// Popup sign-in (restored). Returns the signed-in user.
export async function signIn(): Promise<User> {
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
  return isAdminUid(u?.uid || null);
}
