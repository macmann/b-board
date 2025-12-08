"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type VelocityPoint = {
  sprintId: string;
  sprintName: string;
  committedPoints: number;
  completedPoints: number;
};

type Props = {
  projectId: string;
};

export default function ProjectReportsPageClient({ projectId }: Props) {
  const [data, setData] = useState<VelocityPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;

    const fetchVelocity = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/projects/${projectId}/velocity`);

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.message ?? "Unable to load velocity data.");
          return;
        }

        const payload = await response.json();
        setData(payload);
      } catch (err) {
        setError("An unexpected error occurred while loading velocity data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVelocity();
  }, [projectId]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-600">
            Review recent sprint velocity for this project.
          </p>
        </header>

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Velocity</h2>
              <p className="text-sm text-gray-600">
                Committed versus completed story points across completed sprints.
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 text-gray-600">Loading velocity data...</p>
          ) : error ? (
            <p className="mt-6 text-red-600">{error}</p>
          ) : data.length === 0 ? (
            <p className="mt-6 text-gray-600">
              No completed sprints available to calculate velocity.
            </p>
          ) : (
            <div className="mt-6 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...data].reverse()}
                  margin={{ top: 16, right: 16, left: 0, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sprintName" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="committedPoints" fill="#60a5fa" name="Committed" />
                  <Bar dataKey="completedPoints" fill="#10b981" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
