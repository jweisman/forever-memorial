"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";

type AdminMemorial = {
  id: string;
  slug: string;
  name: string;
  disabled: boolean;
  createdAt: string;
  owner: { id: string; name: string | null; email: string | null };
  _count: { memories: number };
};

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  disabled: boolean;
  createdAt: string;
  _count: { memorials: number; submittedMemories: number };
};

type MemorialMemory = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const t = useTranslations("Admin");
  const [activeTab, setActiveTab] = useState<"memorials" | "users">(
    "memorials"
  );
  const [memorials, setMemorials] = useState<AdminMemorial[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMemorial, setExpandedMemorial] = useState<string | null>(null);
  const [memories, setMemories] = useState<Record<string, MemorialMemory[]>>(
    {}
  );
  const [deletingMemory, setDeletingMemory] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [memRes, userRes] = await Promise.all([
      fetch("/api/admin/memorials"),
      fetch("/api/admin/users"),
    ]);
    if (memRes.ok) setMemorials(await memRes.json());
    if (userRes.ok) setUsers(await userRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  async function toggleMemorial(id: string) {
    const res = await fetch(`/api/admin/memorials/${id}/toggle`, {
      method: "PATCH",
    });
    if (res.ok) {
      const { disabled } = await res.json();
      setMemorials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, disabled } : m))
      );
    }
  }

  async function toggleUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}/toggle`, {
      method: "PATCH",
    });
    if (res.ok) {
      const { disabled } = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, disabled } : u))
      );
    }
  }

  async function loadMemories(memorialId: string) {
    if (expandedMemorial === memorialId) {
      setExpandedMemorial(null);
      return;
    }
    setExpandedMemorial(memorialId);
    if (!memories[memorialId]) {
      const res = await fetch(`/api/admin/memorials/${memorialId}/memories`);
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => ({ ...prev, [memorialId]: data }));
      }
    }
  }

  async function deleteMemory(memoryId: string, memorialId: string) {
    if (deletingMemory !== memoryId) {
      setDeletingMemory(memoryId);
      return;
    }
    const res = await fetch(`/api/admin/memories/${memoryId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMemories((prev) => ({
        ...prev,
        [memorialId]: (prev[memorialId] || []).filter(
          (m) => m.id !== memoryId
        ),
      }));
      setMemorials((prev) =>
        prev.map((m) =>
          m.id === memorialId
            ? { ...m, _count: { ...m._count, memories: m._count.memories - 1 } }
            : m
        )
      );
      setDeletingMemory(null);
    }
  }

  if (status === "loading" || (isAdmin && loading)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="text-muted">{t("loading")}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="text-lg font-medium text-warm-800">
          {t("accessDenied")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        title={t("title")}
        subtitle={t("subtitle")}
        as="h1"
        align="start"
      />

      {/* Tabs */}
      <div className="mt-8 flex gap-4 border-b border-border" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "memorials"}
          aria-controls="panel-memorials"
          id="tab-memorials"
          onClick={() => setActiveTab("memorials")}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === "memorials"
              ? "border-b-2 border-accent text-accent"
              : "text-warm-400 hover:text-warm-600"
          }`}
        >
          {t("memorialsTab")} ({memorials.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "users"}
          aria-controls="panel-users"
          id="tab-users"
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "border-b-2 border-accent text-accent"
              : "text-warm-400 hover:text-warm-600"
          }`}
        >
          {t("usersTab")} ({users.length})
        </button>
      </div>

      {/* Memorials Tab */}
      {activeTab === "memorials" && (
        <div id="panel-memorials" role="tabpanel" aria-labelledby="tab-memorials" className="mt-6 space-y-3">
          {memorials.length === 0 ? (
            <p className="text-sm text-muted">{t("noMemorials")}</p>
          ) : (
            memorials.map((memorial) => (
              <Card key={memorial.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-heading text-base font-semibold text-warm-800">
                        {memorial.name}
                      </h3>
                      {memorial.disabled && (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {t("disabled")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-warm-400">
                      {t("owner")}:{" "}
                      {memorial.owner.name || memorial.owner.email} &middot;{" "}
                      {memorial._count.memories} {t("memoriesCount")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {memorial._count.memories > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadMemories(memorial.id)}
                      >
                        {expandedMemorial === memorial.id
                          ? t("hideMemories")
                          : t("showMemories")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        memorial.disabled
                          ? "text-green-600 hover:text-green-700"
                          : "text-red-600 hover:text-red-700"
                      }
                      onClick={() => toggleMemorial(memorial.id)}
                    >
                      {memorial.disabled ? t("enable") : t("disable")}
                    </Button>
                  </div>
                </div>

                {/* Expanded memories */}
                {expandedMemorial === memorial.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    {!memories[memorial.id] ? (
                      <p className="text-xs text-muted">{t("loading")}</p>
                    ) : memories[memorial.id].length === 0 ? (
                      <p className="text-xs text-muted">{t("noMemories")}</p>
                    ) : (
                      <div className="space-y-3">
                        {memories[memorial.id].map((memory) => (
                          <div
                            key={memory.id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-warm-50 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-warm-800">
                                {memory.name}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-warm-600">
                                {memory.text}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-red-600 hover:text-red-700"
                              onClick={() =>
                                deleteMemory(memory.id, memorial.id)
                              }
                            >
                              {deletingMemory === memory.id
                                ? t("confirmDelete")
                                : t("deleteMemory")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div id="panel-users" role="tabpanel" aria-labelledby="tab-users" className="mt-6 space-y-3">
          {users.length === 0 ? (
            <p className="text-sm text-muted">{t("noUsers")}</p>
          ) : (
            users.map((user) => (
              <Card key={user.id}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-warm-800">
                        {user.name || user.email}
                      </p>
                      {user.role === "ADMIN" && (
                        <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-700">
                          Admin
                        </span>
                      )}
                      {user.disabled && (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {t("banned")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-warm-400">
                      {user.email} &middot; {user._count.memorials}{" "}
                      {t("memorials")} &middot; {user._count.submittedMemories}{" "}
                      {t("memoriesCount")}
                    </p>
                  </div>
                  {user.role !== "ADMIN" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        user.disabled
                          ? "text-green-600 hover:text-green-700"
                          : "text-red-600 hover:text-red-700"
                      }
                      onClick={() => toggleUser(user.id)}
                    >
                      {user.disabled ? t("unban") : t("ban")}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
