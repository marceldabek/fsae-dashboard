import React, { useEffect, useState } from "react";
import { fetchPeople, fetchTasks } from "../lib/firestore";
import type { Person, Task } from "../types";

export default function Leaderboard() {
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [peopleData, tasksData] = await Promise.all([
        fetchPeople(),
        fetchTasks(),
      ]);
      setPeople(peopleData);
      setTasks(tasksData);
      setLoading(false);
    }
    load();
  }, []);

  // Count completed tasks per person
  const leaderboard = people.map(person => {
    const completed = tasks.filter(
      t => t.assignee_id === person.id && t.status === "Complete"
    ).length;
    return { ...person, completed };
  }).sort((a, b) => b.completed - a.completed);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Leaderboard</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full text-sm bg-white text-black border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="w-12 py-2 px-2 border-b text-center">#</th>
              <th className="py-2 px-2 border-b text-left">Name</th>
              <th className="w-36 py-2 px-2 border-b text-center">Completed</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((person, idx) => (
              <tr key={person.id} className={idx === 0 ? "bg-yellow-50" : ""}>
                <td className="py-2 px-2 border-b text-center align-middle">{idx + 1}</td>
                <td className="py-2 px-2 border-b">
                  <div className="max-w-[180px] sm:max-w-[260px] truncate">{person.name}</div>
                </td>
                <td className="py-2 px-2 border-b text-center align-middle">{person.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
