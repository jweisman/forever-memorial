"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";

export default function DashboardPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await update({ name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/user/delete", { method: "DELETE" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    }
    setDeleting(false);
  }

  if (!session?.user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        title="Dashboard"
        subtitle={`Welcome back, ${session.user.name || session.user.email}`}
        as="h1"
        align="start"
      />

      <div className="mt-10 space-y-8">
        {/* Profile Section */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            Profile
          </h2>
          <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-sm font-medium text-warm-700"
              >
                Display name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-700">
                Email
              </label>
              <p className="mt-1 text-sm text-muted">{session.user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
              {saved && (
                <span className="text-sm text-gold-600">Saved!</span>
              )}
            </div>
          </form>
        </Card>

        {/* My Memorials */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            My Memorials
          </h2>
          <p className="mt-2 text-sm text-muted">
            You haven&apos;t created any memorial pages yet.
          </p>
          <div className="mt-4">
            <Button href="#" variant="primary" size="sm">
              Create a Memorial
            </Button>
          </div>
        </Card>

        {/* Pending Reviews */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            Pending Reviews
          </h2>
          <p className="mt-2 text-sm text-muted">
            No pending memory submissions to review.
          </p>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <h2 className="font-heading text-lg font-semibold text-red-700">
            Delete Account
          </h2>
          <p className="mt-2 text-sm text-muted">
            Permanently delete your account and all memorial pages you own. This
            action cannot be undone.
          </p>

          {showDeleteConfirm ? (
            <div className="mt-4 rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Are you sure? All your memorial pages and their content will be
                permanently deleted.
              </p>
              <div className="mt-3 flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete account
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
