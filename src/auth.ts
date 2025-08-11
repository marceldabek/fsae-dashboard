
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { app } from "./firebase";

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
