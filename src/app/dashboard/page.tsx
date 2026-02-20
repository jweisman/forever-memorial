"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import MemoryReviewCard from "@/components/memorial/MemoryReviewCard";
import MySubmissionCard from "@/components/memorial/MySubmissionCard";

type Memorial = {
  id: string;
  slug: string;
  name: string;
  birthday: string | null;
  dateOfDeath: string;
  placeOfDeath: string | null;
  memorialPicture: string | null;
  createdAt: string;
};

function formatDateRange(
  birthday: string | null,
  dateOfDeath: string
): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    return `${birthYear} – ${deathYear}`;
  }
  return `d. ${deathYear}`;
}

export default function DashboardPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Memorials state
  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [loadingMemorials, setLoadingMemorials] = useState(true);
  const [deletingMemorialId, setDeletingMemorialId] = useState<string | null>(
    null
  );

  // Review queue state
  type PendingMemory = {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    status: string;
    createdAt: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null }[];
    memorial: { name: string; slug: string };
  };
  const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showIgnored, setShowIgnored] = useState(false);

  // My submissions state
  type MySubmission = {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    status: string;
    returnMessage: string | null;
    createdAt: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null }[];
    memorial: { id: string; name: string; slug: string };
  };
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  async function fetchPendingMemories(memorialsList: Memorial[]) {
    const allMemories: PendingMemory[] = [];
    for (const mem of memorialsList) {
      const res = await fetch(
        `/api/memorials/${mem.id}/memories?status=PENDING,IGNORED`
      );
      if (res.ok) {
        const memories = await res.json();
        allMemories.push(...memories);
      }
    }
    setPendingMemories(allMemories);
    setLoadingReviews(false);
  }

  async function fetchMySubmissions() {
    const res = await fetch("/api/user/memories");
    if (res.ok) {
      setMySubmissions(await res.json());
    }
    setLoadingSubmissions(false);
  }

  useEffect(() => {
    async function fetchMemorials() {
      const res = await fetch("/api/memorials");
      if (res.ok) {
        const data = await res.json();
        setMemorials(data);
        fetchPendingMemories(data);
      }
      setLoadingMemorials(false);
    }
    fetchMemorials();
    fetchMySubmissions();
  }, []);

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

  async function handleDeleteMemorial(memorialId: string) {
    const res = await fetch(`/api/memorials/${memorialId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMemorials((prev) => prev.filter((m) => m.id !== memorialId));
      setDeletingMemorialId(null);
    }
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
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              My Memorials
            </h2>
            <Button href="/dashboard/create" variant="primary" size="sm">
              Create a Memorial
            </Button>
          </div>

          {loadingMemorials ? (
            <p className="mt-4 text-sm text-muted">Loading...</p>
          ) : memorials.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              You haven&apos;t created any memorial pages yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {memorials.map((memorial) => (
                <div
                  key={memorial.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <Link
                    href={`/memorial/${memorial.slug}`}
                    className="min-w-0 flex-1"
                  >
                    <h3 className="truncate font-heading text-base font-semibold text-warm-800 hover:text-accent">
                      {memorial.name}
                    </h3>
                    <p className="text-sm text-muted">
                      {formatDateRange(memorial.birthday, memorial.dateOfDeath)}
                      {memorial.placeOfDeath &&
                        ` · ${memorial.placeOfDeath}`}
                    </p>
                  </Link>
                  <div className="ml-4 flex shrink-0 gap-2">
                    <Button
                      href={`/memorial/${memorial.slug}/edit`}
                      variant="ghost"
                      size="sm"
                    >
                      Edit
                    </Button>
                    {deletingMemorialId === memorial.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteMemorial(memorial.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingMemorialId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeletingMemorialId(memorial.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending Reviews */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              Pending Reviews
              {pendingMemories.filter((m) => m.status === "PENDING").length >
                0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
                  {
                    pendingMemories.filter((m) => m.status === "PENDING")
                      .length
                  }
                </span>
              )}
            </h2>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={showIgnored}
                onChange={(e) => setShowIgnored(e.target.checked)}
                className="rounded border-warm-300 text-accent focus:ring-accent"
              />
              Show ignored
            </label>
          </div>

          {loadingReviews ? (
            <p className="mt-4 text-sm text-muted">Loading...</p>
          ) : (() => {
            const filtered = pendingMemories.filter(
              (m) => showIgnored || m.status !== "IGNORED"
            );
            if (filtered.length === 0) {
              return (
                <p className="mt-4 text-sm text-muted">
                  No pending memory submissions to review.
                </p>
              );
            }

            // Group by memorial
            const grouped: Record<string, PendingMemory[]> = {};
            for (const mem of filtered) {
              const key = mem.memorial.name;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(mem);
            }

            return (
              <div className="mt-4 space-y-6">
                {Object.entries(grouped).map(([memorialName, memories]) => (
                  <div key={memorialName}>
                    <h3 className="mb-3 font-heading text-base font-semibold text-warm-700">
                      {memorialName}
                    </h3>
                    <div className="space-y-3">
                      {memories.map((memory) => (
                        <MemoryReviewCard
                          key={memory.id}
                          memory={memory}
                          onReviewed={() => fetchPendingMemories(memorials)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>

        {/* My Submissions */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            My Submissions
          </h2>

          {loadingSubmissions ? (
            <p className="mt-4 text-sm text-muted">Loading...</p>
          ) : mySubmissions.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              You haven&apos;t submitted any memories yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {mySubmissions.map((memory) => (
                <MySubmissionCard
                  key={memory.id}
                  memory={memory}
                  onChanged={fetchMySubmissions}
                />
              ))}
            </div>
          )}
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
