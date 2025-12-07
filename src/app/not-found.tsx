export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center text-gray-800">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-gray-600">
          The page you are looking for does not exist.
        </p>
        <a
          href="/projects"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Back to projects
        </a>
      </div>
    </div>
  );
}
