"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center text-gray-800">
        <h1 className="text-2xl font-bold">Something went wrong.</h1>
        <p className="mt-2 text-gray-600">
          Please try again or contact the admin.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Try again
          </button>
          <a
            href="/my-projects"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-50"
          >
            Back to projects
          </a>
        </div>
      </div>
    </div>
  );
}
