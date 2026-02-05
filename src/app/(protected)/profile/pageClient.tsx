"use client";

import { useEffect, useMemo, useState } from "react";

import { Role } from "@/lib/prismaEnums";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const inputClasses =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary";
const labelClasses = "text-sm font-medium text-slate-700 dark:text-slate-200";

const MIN_PASSWORD_LENGTH = 8;

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
};

type ProjectAccess = {
  id: string;
  name: string;
  key: string | null;
  role: Role;
};

type ProfilePageClientProps = {
  user: ProfileUser;
  projects: ProjectAccess[];
};

const getInitials = (name: string, email: string) => {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

const formatRole = (role: Role) => role.replace("_", " ");

export default function ProfilePageClient({ user, projects }: ProfilePageClientProps) {
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const avatarPreview = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileStatus(null);
    setProfileError(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setProfileError("Name is required.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setProfileError(payload?.message ?? "Failed to update profile.");
        return;
      }

      setName(payload?.name ?? trimmedName);
      setProfileStatus("Profile updated successfully.");
    } catch (error) {
      setProfileError("Unable to update your profile right now.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async () => {
    setAvatarStatus(null);
    setAvatarError(null);

    if (!avatarFile) {
      setAvatarError("Choose an image to upload.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", avatarFile);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        setAvatarError(payload?.message ?? "Failed to upload avatar.");
        return;
      }

      setAvatarUrl(payload?.avatarUrl ?? null);
      setAvatarFile(null);
      setAvatarStatus("Profile photo updated.");
    } catch (error) {
      setAvatarError("Unable to upload avatar right now.");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill out all password fields.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setPasswordError(payload?.message ?? "Failed to update password.");
        return;
      }

      setPasswordStatus("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError("Unable to update your password right now.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Profile</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your personal details and review your project access.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Profile photo</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Upload a JPG or PNG under 5MB.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarPreview || avatarUrl ? (
                <img
                  src={avatarPreview ?? avatarUrl ?? ""}
                  alt="Profile avatar"
                  className="h-16 w-16 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {getInitials(name, user.email)}
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setAvatarFile(event.target.files?.[0] ?? null);
                    setAvatarStatus(null);
                    setAvatarError(null);
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700"
                />
                <Button type="button" onClick={handleAvatarUpload} disabled={isUploading || !avatarFile}>
                  {isUploading ? "Uploading..." : "Upload photo"}
                </Button>
              </div>
            </div>
            {avatarError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {avatarError}
              </div>
            )}
            {avatarStatus && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {avatarStatus}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Personal information</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Update your name and review account details.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleProfileSave}>
                <div className="space-y-1">
                  <label className={labelClasses} htmlFor="profile-name">
                    Full name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClasses}
                    disabled={isSavingProfile}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className={labelClasses} htmlFor="profile-email">
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={user.email}
                      className={inputClasses}
                      disabled
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClasses} htmlFor="profile-role">
                      Workspace role
                    </label>
                    <input
                      id="profile-role"
                      type="text"
                      value={formatRole(user.role)}
                      className={inputClasses}
                      disabled
                    />
                  </div>
                </div>
                {profileError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {profileError}
                  </div>
                )}
                {profileStatus && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {profileStatus}
                  </div>
                )}
                <Button type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Change password</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Choose a strong password to protect your account.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordSave}>
                <div className="space-y-1">
                  <label className={labelClasses} htmlFor="current-password">
                    Current password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className={inputClasses}
                    disabled={isSavingPassword}
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className={labelClasses} htmlFor="new-password">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={inputClasses}
                      disabled={isSavingPassword}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClasses} htmlFor="confirm-password">
                      Confirm new password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={inputClasses}
                      disabled={isSavingPassword}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {passwordError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {passwordError}
                  </div>
                )}
                {passwordStatus && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {passwordStatus}
                  </div>
                )}
                <Button type="submit" disabled={isSavingPassword}>
                  {isSavingPassword ? "Updating..." : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Project access</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Projects you can access and your role in each.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No project access assigned.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Project</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-50">
                          {project.name}
                        </div>
                        {project.key && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{project.key}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatRole(project.role)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
