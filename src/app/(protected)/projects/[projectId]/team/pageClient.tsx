"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role } from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";
import { canInviteMembers } from "../../../../../lib/uiPermissions";

type Member = {
  id: string;
  role: Role;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
};

type ProjectTeamPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

const ROLE_OPTIONS = [Role.ADMIN, Role.PO, Role.DEV, Role.QA, Role.VIEWER];

export default function ProjectTeamPageClient({
  projectId,
  projectRole,
}: ProjectTeamPageClientProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.DEV);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const allowInvites = canInviteMembers(projectRole);

  const fetchTeamData = async () => {
    setIsLoading(true);
    setError("");

    try {
      const membersResponse = await fetch(`/api/projects/${projectId}/members`);

      if (!membersResponse.ok) {
        const data = await membersResponse.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to load members.");
      }

      const membersData = await membersResponse.json();
      setMembers(membersData);

      if (allowInvites) {
        const invitationsResponse = await fetch(
          `/api/projects/${projectId}/invitations`
        );

        if (!invitationsResponse.ok) {
          const data = await invitationsResponse.json().catch(() => null);
          throw new Error(data?.message ?? "Failed to load invitations.");
        }

        const invitationsData = await invitationsResponse.json();
        setInvitations(invitationsData);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading team data."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;

    fetchTeamData();
  }, [projectId]);

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setCopyStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Unable to send invitation.");
      }

      const data = await response.json();
      setInviteUrl(data.inviteUrl);
      setEmail("");
      setRole(Role.DEV);
      await fetchTeamData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send the invitation."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingInvitations = useMemo(() => invitations, [invitations]);

  const handleCopy = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("Invite link copied!");
    } catch (err) {
      setCopyStatus("Unable to copy invite link.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Team</h1>
            <p className="text-gray-600">
              Manage project members and send invitations.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchTeamData}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Current Members</h2>
            <p className="text-sm text-gray-500">
              Only Admins and Product Owners can manage the team.
            </p>
          </div>

          {isLoading ? (
            <p className="mt-4 text-gray-600">Loading team members...</p>
          ) : members.length === 0 ? (
            <p className="mt-4 text-gray-600">No members found.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                      Email
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
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {member.user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {member.user.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {member.role}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">Pending Invitations</h2>
          {isLoading ? (
            <p className="mt-4 text-gray-600">Loading invitations...</p>
          ) : pendingInvitations.length === 0 ? (
            <p className="mt-4 text-gray-600">No pending invitations.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Role
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Expires At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {pendingInvitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {invitation.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {invitation.role}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(invitation.expiresAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {allowInvites ? (
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">Invite Member</h2>
            <p className="mt-1 text-sm text-gray-600">
              Send an invitation link to add a new member to this project.
            </p>

            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleInviteSubmit}>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSubmitting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>

            {inviteUrl && (
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-gray-900">Invite Link</p>
                <p className="mt-2 break-all text-sm text-gray-700">{inviteUrl}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Copy Link
                  </button>
                  {copyStatus && <p className="text-sm text-gray-700">{copyStatus}</p>}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">Invite Member</h2>
            <p className="mt-2 text-sm text-gray-600">You do not have permission to invite members.</p>
          </section>
        )}
      </div>
    </main>
  );
}
