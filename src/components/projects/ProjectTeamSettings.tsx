"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Role } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { canInviteMembers } from "@/lib/uiPermissions";

export type ProjectTeamSettingsProps = {
  projectId: string;
  projectRole: ProjectRole | null;
  showHeader?: boolean;
  initialMembers?: Member[];
  initialInvitations?: Invitation[];
};

type Member = {
  id: string;
  createdAt?: string;
  role: Role;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
};

const ROLE_OPTIONS = [Role.ADMIN, Role.PO, Role.DEV, Role.QA, Role.VIEWER];

export default function ProjectTeamSettings({
  projectId,
  projectRole,
  showHeader = true,
  initialMembers,
  initialInvitations,
}: ProjectTeamSettingsProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);
  const [invitations, setInvitations] = useState<Invitation[]>(
    initialInvitations ?? []
  );
  const [isLoading, setIsLoading] = useState(!initialMembers);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.DEV);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const inviteSectionRef = useRef<HTMLDivElement | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, allowInvites]);

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

  const getInitials = (name: string | null | undefined, email?: string | null) => {
    const source = name || email || "";
    const parts = source.trim().split(" ");

    if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase();

    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  };

  const formatJoined = (date?: string) => {
    if (!date) return "";

    const joinedDate = new Date(date);
    if (Number.isNaN(joinedDate.getTime())) return "";

    const now = new Date();
    const diff = now.getTime() - joinedDate.getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));

    if (months <= 0) return "Joined recently";
    if (months === 1) return "Joined 1 month ago";
    return `Joined ${months} months ago`;
  };

  const handleOpenInvite = () => {
    inviteSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
    <div className="space-y-4">
      {showHeader && (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Team
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage project members, roles, and invitations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={fetchTeamData}
              className="px-3 py-2 text-sm"
            >
              Refresh
            </Button>
            {allowInvites ? (
              <Button
                variant="primary"
                onClick={handleOpenInvite}
                className="px-3 py-2 text-sm"
              >
                Invite member
              </Button>
            ) : (
              <Button variant="secondary" className="px-3 py-2 text-sm" disabled>
                Invite member
              </Button>
            )}
          </div>
        </header>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Members
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only Admins and Product Owners can manage the team.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            Loading team members...
          </div>
        ) : members.length <= 1 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            You’re the only member in this project. Invite teammates to collaborate.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                      {getInitials(member.user.name, member.user.email)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-900 dark:text-slate-50">
                        {member.user.name || member.user.email}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {member.user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {member.role}
                    </span>
                    {formatJoined(member.createdAt) && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatJoined(member.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Pending invitations
          </h3>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            Loading invitations...
          </div>
        ) : pendingInvitations.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            No pending invitations.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-900 dark:text-slate-50">
                      {invitation.email}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Expires {new Date(invitation.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {invitation.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {allowInvites ? (
        <section
          ref={inviteSectionRef}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Invite member
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send an invitation link to add a new member to this project.
              </p>
            </div>
            <span className="text-[11px] uppercase text-slate-400">Invite form</span>
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleInviteSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send invitation"}
              </Button>
            </div>
          </form>

          {inviteUrl && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-slate-800 dark:border-primary/30 dark:bg-primary/10 dark:text-slate-50">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Invite link</p>
              <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">{inviteUrl}</p>
              <div className="mt-3 flex items-center gap-3">
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                  onClick={handleCopy}
                >
                  Copy link
                </Button>
                {copyStatus && (
                  <p className="text-sm text-slate-700 dark:text-slate-300">{copyStatus}</p>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Invite member</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            You do not have permission to invite members.
          </p>
        </section>
      )}
    </div>
  );
}
