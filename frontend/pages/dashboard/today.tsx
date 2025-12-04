import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Task = {
  id: string;
  type: string;
  status: string;
  application_id: string;
  due_at: string;
};

export default function TodayDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    setLoading(true);
    setError(null);

    try {
      // Calculate start and end of today
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .neq("status", "completed") // status ≠ completed
        .gte("due_at", startOfDay)
        .lte("due_at", endOfDay)
        .order("due_at", { ascending: true });

      if (error) throw error;

      setTasks(data || []);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(id: string) {
    try {
      // Optimistic update
      setTasks((prev) => prev.filter((task) => task.id !== id));

      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", id);

      if (error) throw error;
      
      // Optional: re-fetch to ensure sync
      // fetchTasks(); 
    } catch (err: any) {
      console.error(err);
      alert("Failed to update task");
      fetchTasks(); // Revert on error
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  if (loading) return <div>Loading tasks...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <main style={{ padding: "1.5rem" }}>
      <h1>Today&apos;s Tasks</h1>
      {tasks.length === 0 && <p>No tasks due today 🎉</p>}

      {tasks.length > 0 && (
        <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "8px" }}>Type</th>
              <th style={{ padding: "8px" }}>Application ID</th>
              <th style={{ padding: "8px" }}>Due At</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>{t.type}</td>
                <td style={{ padding: "8px" }}>{t.application_id}</td>
                <td style={{ padding: "8px" }}>{new Date(t.due_at).toLocaleTimeString()}</td>
                <td style={{ padding: "8px" }}>{t.status}</td>
                <td style={{ padding: "8px" }}>
                  <button 
                    onClick={() => markComplete(t.id)}
                    style={{ padding: "4px 8px", cursor: "pointer" }}
                  >
                    Mark Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}