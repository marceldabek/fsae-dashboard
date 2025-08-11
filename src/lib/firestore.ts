
import { getFirestore, collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { app } from "../firebase";
import type { Person, Project, Task } from "../types";

export const db = getFirestore(app);

export async function fetchPeople(): Promise<Person[]> {
  const snap = await getDocs(collection(db, "people"));
  return snap.docs.map(d => d.data() as Person);
}

export async function fetchProjects(): Promise<Project[]> {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map(d => d.data() as Project);
}

export async function fetchTasks(): Promise<Task[]> {
  const snap = await getDocs(collection(db, "tasks"));
  return snap.docs.map(d => d.data() as Task);
}

export async function fetchTasksForProject(projectId: string): Promise<Task[]> {
  const q = query(collection(db, "tasks"), where("project_id", "==", projectId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Task);
}

// Admin-only ops (security enforced by Firestore Rules)
export async function addTask(t: Omit<Task, "id">) {
  const ref = await addDoc(collection(db, "tasks"), t);
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function updateTask(id: string, data: Partial<Task>) {
  const ref = doc(db, "tasks", id);
  await updateDoc(ref, data);
}

export async function deleteTaskById(id: string) {
  const ref = doc(db, "tasks", id);
  await deleteDoc(ref);
}


export async function updateProjectOwners(projectId: string, owner_ids: string[]) {
  const ref = doc(db, "projects", projectId);
  await updateDoc(ref, { owner_ids });
}


export async function addPerson(p: Omit<Person, "id"> & { id?: string }) {
  if (p.id) {
    const ref = doc(db, "people", p.id);
    await setDoc(ref, { ...p, id: p.id }, { merge: true }); // create-or-merge
    return p.id;
  } else {
    const ref = await addDoc(collection(db, "people"), p as any); // auto-id
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  }
}

export async function addProject(pr: Omit<Project, "id"> & { id?: string }) {
  if (pr.id) {
    const ref = doc(db, "projects", pr.id);
    await setDoc(ref, { ...pr, id: pr.id }, { merge: true }); // create-or-merge
    return pr.id;
  } else {
    const ref = await addDoc(collection(db, "projects"), pr as any);
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  }
}

// Simple settings doc: settings/global => { rulebook_url?: string }
export async function updatePerson(id: string, patch: Partial<Person>) {
  const ref = doc(db, "people", id);
  await updateDoc(ref, patch as any);
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const ref = doc(db, "projects", id);
  await updateDoc(ref, patch as any);
}

export async function fetchSettings(): Promise<{ rulebook_url?: string; sharepoint_url?: string } | null> {
  const ref = doc(db, "settings", "global");
  const snap = await getDocs(collection(db, "settings"));
  const d = snap.docs.find(x => x.id === "global");
  return d ? (d.data() as any) : null;
}

export async function setSettings(data: { rulebook_url?: string; sharepoint_url?: string }) {
  const ref = doc(db, "settings", "global");
  await setDoc(ref, { ...(data || {}) }, { merge: true });
}
