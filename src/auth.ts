
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, signInWithCustomToken } from "firebase/auth";
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

// Discord OAuth via Cloud Functions popup
// - Opens: https://us-central1-uconn-fsae-ev.cloudfunctions.net/discordLogin
// - Listens for a postMessage from the popup (origin must be Cloud Functions origin)
// - Signs in with the received custom token
export async function signInWithDiscord(): Promise<User> {
  const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
  const functionsBase = isLocal
    ? "http://127.0.0.1:5002/uconn-fsae-ev/us-central1"
    : "https://us-central1-uconn-fsae-ev.cloudfunctions.net"; // project: uconn-fsae-ev
  const localOrigin127 = new URL("http://127.0.0.1:5002").origin;
  const localOriginLocalhost = new URL("http://localhost:5002").origin;
  const prodOrigin = new URL("https://us-central1-uconn-fsae-ev.cloudfunctions.net").origin;
  const allowedOrigins = new Set([localOrigin127, localOriginLocalhost, prodOrigin]);
  const loginUrl = `${functionsBase}/discordLogin`;

  // Open centered popup
  const w = 520, h = 720;
  const dualLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
  const dualTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = Math.max(0, (width - w) / 2 + dualLeft);
  const top = Math.max(0, (height - h) / 2 + dualTop);
  const features = `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`;

  const popup = window.open(loginUrl, "discord-auth", features) || null;

  return new Promise<User>((resolve, reject) => {
    let done = false;
    const finish = (err?: unknown, u?: User) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      if (popup && !popup.closed) try { popup.close(); } catch {}
      if (err) return reject(err);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolve(u!);
    };

  const onMsg = async (event: MessageEvent) => {
      try {
    // Verify sender is the Cloud Functions origin (not the web origin)
    if (!allowedOrigins.has(event.origin)) return;
        const data = event.data as { source?: string; token?: string } | null;
        if (!data || data.source !== "discord-auth" || !data.token) return;
        const cred = await signInWithCustomToken(auth, data.token);
        finish(undefined, cred.user);
      } catch (e) {
        finish(e);
      }
    };

    window.addEventListener("message", onMsg);

    // Fallbacks: if popup blocked, navigate in-page
    if (!popup || popup.closed) {
      window.location.assign(loginUrl);
    }

    // Timeout after 2 minutes
    setTimeout(() => finish(new Error("Discord login timed out")), 2 * 60 * 1000);
  });
}
