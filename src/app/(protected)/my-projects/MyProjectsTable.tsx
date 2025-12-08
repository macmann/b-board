"use client";

import { useRouter } from "next/navigation";

import { ProjectRole } from "../../../lib/roles";

type MyProject = {
  id: string;
  key: string;
  name: string;
  description?: string;
  role: ProjectRole;
};

export function MyProjectsTable({ projects }: { projects: MyProject[] }) {
  const router = useRouter();

  const handleRowClick = (projectId: string) => {
    router.push(`/projects/${projectId}/backlog`);
  };

  if (projects.length === 0) {
    return <p className="mt-4 text-gray-600">You are not a member of any projects yet.</p>;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Key
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Description
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Role
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {projects.map((project) => (
            <tr
              key={project.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => handleRowClick(project.id)}
            >
              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{project.key}</td>
              <td className="px-6 py-4 text-sm text-gray-900">{project.name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{project.description ?? "—"}</td>
              <td className="px-6 py-4 text-sm font-medium text-gray-700">{project.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
