import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { ADMIN_UID } from "../admin";
import type { Person, Project } from "../types";
import {
  fetchPeople,
  fetchProjects,
  fetchSettings,
  setSettings,
  addPerson,
  addProject,
  addTask,
  updatePerson,
  updateProject,
} from "../lib/firestore";

export default function Admin() {
  const user = useAuth();
  const isAdmin = user?.uid === ADMIN_UID;

  // Data
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettingsState] = useState<{ rulebook_url?: string; sharepoint_url?: string } | null>(null);

  // Settings inputs
  const [ruleUrl, setRuleUrl] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  // Create Person
  const [pName, setPName] = useState("");
  const [pYear, setPYear] = useState("Senior");
  const [pSkills, setPSkills] = useState("");
  const [pRole, setPRole] = useState("");

  // Create Project
  const [prName, setPrName] = useState("");
  const [prOwners, setPrOwners] = useState<string[]>([]);
  const [prDesign, setPrDesign] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [prDue, setPrDue] = useState("");

  // Create Task
  const [tProject, setTProject] = useState<string>("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<"Todo" | "In Progress" | "Complete">("In Progress");

  // Load data/settings once
  useEffect(() => {
    (async () => {
      const [pe, pr, st] = await Promise.all([fetchPeople(), fetchProjects(), fetchSettings()]);
      setPeople(pe);
      setProjects(pr);
      setSettingsState(st);
      setRuleUrl(st?.rulebook_url || "");
      setShareUrl(st?.sharepoint_url || "");
    })();
  }, []);

  // Keep inputs in sync if settings change
  useEffect(() => {
    setRuleUrl(settings?.rulebook_url || "");
    setShareUrl(settings?.sharepoint_url || "");
  }, [settings]);

  // Helpers
  const toggleOwner = (id: string) =>
    setPrOwners((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function handleSaveSettings() {
    try {
      await setSettings({
        rulebook_url: ruleUrl.trim() || undefined,
        sharepoint_url: shareUrl.trim() || undefined,
      });
      setSettingsState(await fetchSettings());
      alert("Settings saved");
    } catch (e: any) {
      console.error(e);
      alert("Save failed: " + (e?.message || e));
    }
  }

  async function handleCreatePerson() {
    try {
      const id = await addPerson({
        name: pName.trim(),
        year: pYear,
        role: pRole.trim() || undefined,
        skills: pSkills.split(",").map((s) => s.trim()).filter(Boolean),
      } as any);
      setPeople(await fetchPeople());
      setPName("");
      setPYear("Senior");
      setPRole("");
      setPSkills("");
      alert("Person saved: " + id);
    } catch (e: any) {
      console.error(e);
      alert("Save failed: " + (e?.message || e));
    }
  }

  async function handleCreateProject() {
    if (!prName.trim()) return alert("Give the project a name");
    try {
      const id = await addProject({
        name: prName.trim(),
        owner_ids: prOwners,
        design_link: prDesign.trim() || undefined,
        description: prDesc.trim() || undefined,
        due_date: prDue || undefined, // YYYY-MM-DD
      } as any);
      setProjects(await fetchProjects());
      setPrName("");
      setPrOwners([]);
      setPrDesign("");
      setPrDesc("");
      setPrDue("");
      alert("Project saved: " + id);
    } catch (e: any) {
      console.error(e);
      alert("Save failed: " + (e?.message || e));
    }
  }

  async function handleCreateTask() {
    if (!tProject) return alert("Choose a project");
    try {
      const id = await addTask({ project_id: tProject, description: tDesc.trim(), status: tStatus });
      setTProject("");
      setTDesc("");
      setTStatus("In Progress");
      alert("Task saved: " + id);
    } catch (e: any) {
      console.error(e);
      alert("Save failed: " + (e?.message || e));
    }
  }

  if (!isAdmin) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-uconn-muted mt-2">You must be signed in as admin to access this page.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Admin</h1>

      {/* Global settings */}
      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">Global Settings</h2>
        <div className="rounded-2xl bg-uconn-surface border border-uconn-border p-4 space-y-2">
          <label className="text-sm block">Rulebook PDF URL</label>
          <input
            className="px-3 py-2 rounded bg-white text-black w-full"
            placeholder="https://…/rulebook.pdf"
            value={ruleUrl}
            onChange={(e) => setRuleUrl(e.target.value)}
          />

          <label className="text-sm block mt-2">Team SharePoint URL</label>
          <input
            className="px-3 py-2 rounded bg-white text-black w-full"
            placeholder="https://…sharepoint.com/sites/FSAE/…"
            value={shareUrl}
            onChange={(e) => setShareUrl(e.target.value)}
          />

          <button
            onClick={handleSaveSettings}
            className="mt-2 px-3 py-2 rounded bg-white/10 border border-uconn-border"
          >
            Save Settings
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create Person */}
        <section className="space-y-2">
          <h2 className="font-semibold">Create Person</h2>
          <div className="rounded-2xl bg-uconn-surface border border-uconn-border p-4 space-y-2">
            <input
              className="px-3 py-2 rounded bg-white text-black w-full"
              placeholder="Name"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                className="px-3 py-2 rounded bg-white text-black"
                value={pYear}
                onChange={(e) => setPYear(e.target.value)}
              >
                <option>Freshman</option>
                <option>Sophomore</option>
                <option>Junior</option>
                <option>Senior</option>
                <option>Graduate</option>
              </select>
              <input
                className="px-3 py-2 rounded bg-white text-black flex-1"
                placeholder="Role (optional)"
                value={pRole}
                onChange={(e) => setPRole(e.target.value)}
              />
            </div>
            <input
              className="px-3 py-2 rounded bg-white text-black w-full"
              placeholder="Skills (comma-separated)"
              value={pSkills}
              onChange={(e) => setPSkills(e.target.value)}
            />
            <button
              onClick={handleCreatePerson}
              className="px-3 py-2 rounded bg-white/10 border border-uconn-border"
            >
              Save Person
            </button>
          </div>

          {/* Create Task */}
          <h2 className="font-semibold mt-6">Create Task</h2>
          <div className="rounded-2xl bg-uconn-surface border border-uconn-border p-4 space-y-2">
            <select
              className="px-3 py-2 rounded bg-white text-black w-full"
              value={tProject}
              onChange={(e) => setTProject(e.target.value)}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="px-3 py-2 rounded bg-white text-black w-full"
              placeholder="Task description"
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
            />
            <select
              className="px-3 py-2 rounded bg-white text-black"
              value={tStatus}
              onChange={(e) => setTStatus(e.target.value as any)}
            >
              <option>Todo</option>
              <option>In Progress</option>
              <option>Complete</option>
            </select>
            <button
              onClick={handleCreateTask}
              className="px-3 py-2 rounded bg-white/10 border border-uconn-border"
            >
              Save Task
            </button>
          </div>
        </section>

        {/* Create Project */}
        <section className="space-y-2">
          <h2 className="font-semibold">Create Project & Assign Owners</h2>
          <div className="rounded-2xl bg-uconn-surface border border-uconn-border p-4 space-y-2">
            <input
              className="px-3 py-2 rounded bg-white text-black w-full"
              placeholder="Project name"
              value={prName}
              onChange={(e) => setPrName(e.target.value)}
            />
            <input
              className="px-3 py-2 rounded bg-white text-black w-full"
              placeholder="Design link (optional)"
              value={prDesign}
              onChange={(e) => setPrDesign(e.target.value)}
            />
            <textarea
              className="px-3 py-2 rounded bg-white text-black w-full"
              placeholder="Project description (optional)"
              value={prDesc}
              onChange={(e) => setPrDesc(e.target.value)}
            />
            <input
              type="date"
              className="px-3 py-2 rounded bg-white text-black"
              value={prDue}
              onChange={(e) => setPrDue(e.target.value)}
            />
            <div className="text-sm text-uconn-muted">Owners</div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-auto border border-uconn-border rounded p-2">
              {people.map((p) => {
                const selected = prOwners.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleOwner(p.id)}
                    className={"text-left px-2 py-1 rounded border " + (selected ? "bg-white/20" : "")}
                  >
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-uconn-muted">{p.skills?.join(", ")}</div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleCreateProject}
              className="px-3 py-2 rounded bg-white/10 border border-uconn-border"
            >
              Save Project
            </button>
          </div>
        </section>

        {/* Edit People */}
        <section className="mt-8">
          <h2 className="font-semibold mb-2">People (click to edit)</h2>
          <div className="space-y-2">
            {people.map((p) => (
              <details key={p.id} className="rounded-2xl bg-uconn-surface border border-uconn-border p-3">
                <summary className="cursor-pointer font-medium">{p.name}</summary>
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  <input
                    className="px-3 py-2 rounded bg-white text-black"
                    value={p.name}
                    onChange={(e) =>
                      setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <select
                    className="px-3 py-2 rounded bg-white text-black"
                    value={p.year || "Senior"}
                    onChange={(e) =>
                      setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, year: e.target.value } : x)))
                    }
                  >
                    <option>Freshman</option>
                    <option>Sophomore</option>
                    <option>Junior</option>
                    <option>Senior</option>
                    <option>Graduate</option>
                  </select>
                  <input
                    className="px-3 py-2 rounded bg-white text-black"
                    placeholder="Role"
                    value={p.role || ""}
                    onChange={(e) =>
                      setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, role: e.target.value } : x)))
                    }
                  />
                  <input
                    className="px-3 py-2 rounded bg-white text-black sm:col-span-2"
                    placeholder="Skills (comma-separated)"
                    value={(p.skills || []).join(", ")}
                    onChange={(e) =>
                      setPeople((prev) =>
                        prev.map((x) =>
                          x.id === p.id
                            ? {
                                ...x,
                                skills: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : x
                        )
                      )
                    }
                  />
                  <button
                    className="px-3 py-2 rounded bg-white/10 border border-uconn-border sm:col-span-2"
                    onClick={async () => {
                      await updatePerson(p.id, p);
                      alert("Saved");
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Edit Projects */}
        <section className="mt-8">
          <h2 className="font-semibold mb-2">Projects (click to edit)</h2>
          <div className="space-y-2">
            {projects.map((p) => (
              <details key={p.id} className="rounded-2xl bg-uconn-surface border border-uconn-border p-3">
                <summary className="cursor-pointer font-medium">{p.name}</summary>
                <div className="mt-2 space-y-2">
                  <input
                    className="px-3 py-2 rounded bg-white text-black w-full"
                    value={p.name}
                    onChange={(e) =>
                      setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <input
                    className="px-3 py-2 rounded bg-white text-black w-full"
                    placeholder="Design link"
                    value={p.design_link || ""}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, design_link: e.target.value } : x))
                      )
                    }
                  />
                  <textarea
                    className="px-3 py-2 rounded bg-white text-black w-full"
                    placeholder="Description"
                    value={p.description || ""}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    type="date"
                    className="px-3 py-2 rounded bg-white text-black"
                    value={p.due_date || ""}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, due_date: e.target.value } : x))
                      )
                    }
                  />
                  <button
                    className="px-3 py-2 rounded bg-white/10 border border-uconn-border w-full"
                    onClick={async () => {
                      await updateProject(p.id, p);
                      alert("Saved");
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
