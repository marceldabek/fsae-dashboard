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
      <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Rank</th>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Completed Tasks</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((person, idx) => (
              <tr key={person.id} className={idx === 0 ? "bg-yellow-100" : ""}>
                <td className="py-2 px-4 border-b text-center">{idx + 1}</td>
                <td className="py-2 px-4 border-b">{person.name}</td>
                <td className="py-2 px-4 border-b text-center">{person.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
