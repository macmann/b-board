"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BurndownPoint = {
  date: string;
  remainingPoints: number;
};

export default function SprintReportsPage() {
  const params = useParams();
  const sprintId = params?.sprintId as string;

  const [data, setData] = useState<BurndownPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sprintId) return;

    const fetchBurndown = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/sprints/${sprintId}/burndown`);

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.message ?? "Unable to load burndown data.");
          return;
        }

        const payload = await response.json();
        setData(payload);
      } catch (err) {
        setError("An unexpected error occurred while loading burndown data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBurndown();
  }, [sprintId]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">Sprint Reports</h1>
          <p className="text-gray-600">
            Track remaining story points for this sprint over time.
          </p>
        </header>

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Burndown</h2>
              <p className="text-sm text-gray-600">
                Remaining story points by day for the sprint duration.
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 text-gray-600">Loading burndown data...</p>
          ) : error ? (
            <p className="mt-6 text-red-600">{error}</p>
          ) : data.length === 0 ? (
            <p className="mt-6 text-gray-600">No data available for this sprint.</p>
          ) : (
            <div className="mt-6 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 16, right: 16, left: 0, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="remainingPoints"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    name="Remaining"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
