# Builds QA Checklist

Use the optional sample data to accelerate validation when developing locally:

- Ensure `DATABASE_URL` points to your test database.
- Run `npm run seed:builds` to create a demo workspace, project, builds, and linked issues. The script is idempotent for the provided build keys.

## Functional flows
- **Builds CRUD**
  - Load `/projects/:projectId/builds` to verify the list renders and empty states behave.
  - Create a build with key, environment, status, and optional dates; confirm it appears in the list without a full refresh.
  - Edit an existing build (status, planned/deployed dates, description) and confirm the detail page reflects updates.
  - Delete a build that is not deployed; verify safeguards prevent removing deployed builds.
- **Unique key enforcement per project**
  - Attempt to create a second build with the same key in the same project and confirm a validation error is shown.
  - Create the same key in a different project to confirm cross-project uniqueness is allowed.
- **Issue link/unlink constraints**
  - Link multiple project issues to a build; counts should update and no duplicates should appear.
  - Attempt to link an issue from another project and confirm a friendly error.
  - Unlink issues and confirm the build and issue detail views stay in sync.
- **Sprint-derived builds list**
  - Open a sprint page and verify the "Builds touching this sprint" section shows builds connected through sprint issues.
  - Confirm builds without sprint-linked issues do not appear in the sprint summary list.
- **Permissions**
  - Admin/PM roles can create, edit, delete builds and link/unlink issues.
  - Contributor/viewer roles can view builds and linked issues but are blocked from restricted actions.
- **Mobile responsiveness**
  - Narrow the viewport to ensure build lists, filters, and detail panels remain usable without overflow.
- **Dark mode**
  - Toggle the theme to confirm text, badges, and status/environment pills remain legible with appropriate contrast.
