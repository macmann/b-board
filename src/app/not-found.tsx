import Link from "next/link";

import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-10 py-12 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          404 · Page not found
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          The page you are looking for does not exist.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          It may have been moved, deleted, or the project id is invalid.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href={routes.myProjects()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
