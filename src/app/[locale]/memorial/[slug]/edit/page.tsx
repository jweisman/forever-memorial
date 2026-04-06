"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { parseIdFromSlug } from "@/lib/slug";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import RichTextEditor from "@/components/ui/RichTextEditor";
import EulogyForm from "@/components/memorial/EulogyForm";
import MemorialPictureUploader from "@/components/memorial/MemorialPictureUploader";
import AlbumSection from "@/components/memorial/AlbumSection";
import MemoryEditCard from "@/components/memorial/MemoryEditCard";
import { use } from "react";

type Eulogy = {
  id: string;
  text: string;
  deliveredBy: string;
  relation: string | null;
  order: number;
};

type ImageRecord = {
  id: string;
  s3Key: string;
  albumId: string;
  caption: string | null;
  order: number;
  mediaType: "IMAGE" | "VIDEO";
  thumbUrl: string;
  url: string;
};

type Album = {
  id: string;
  name: string;
  images: ImageRecord[];
};

type MemorialLink = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  order: number;
};

type Memorial = {
  id: string;
  slug: string;
  name: string;
  additionalName: string | null;
  birthday: string | null;
  dateOfDeath: string;
  placeOfBirth: string | null;
  placeOfDeath: string | null;
  funeralInfo: string | null;
  survivedBy: string | null;
  lifeStory: string | null;
  projects: string | null;
  deathAfterSunset: boolean;
  memorialPicture: string | null;
  ownerId: string;
  eulogies: Eulogy[];
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

export default function MemorialEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("EditMemorial");
  const memorialId = parseIdFromSlug(slug);

  const [memorial, setMemorial] = useState<Memorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [additionalName, setHebrewName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [funeralInfo, setFuneralInfo] = useState("");
  const [survivedBy, setSurvivedBy] = useState("");
  const [lifeStory, setLifeStory] = useState("");
  const [projects, setProjects] = useState("");
  const [deathAfterSunset, setDeathAfterSunset] = useState(false);

  // Links state
  const [links, setLinks] = useState<MemorialLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Memorial picture
  const [memorialPictureUrl, setMemorialPictureUrl] = useState<string | null>(
    null
  );

  // Eulogy state
  const [eulogies, setEulogies] = useState<Eulogy[]>([]);
  const [showEulogyForm, setShowEulogyForm] = useState(false);
  const [editingEulogyId, setEditingEulogyId] = useState<string | null>(null);

  // Gallery state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [totalImageCount, setTotalImageCount] = useState(0);
  const [albumDragIndex, setAlbumDragIndex] = useState<number | null>(null);
  const [albumDropIndex, setAlbumDropIndex] = useState<number | null>(null);

  // Memories state
  type MemoryRecord = {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null; mediaType: "IMAGE" | "VIDEO" }[];
  };
  const [memories, setMemories] = useState<MemoryRecord[]>([]);

  const fetchMemorial = useCallback(async () => {
    const res = await fetch(`/api/memorials/${memorialId}`);
    if (!res.ok) {
      setError("Memorial not found");
      setLoading(false);
      return;
    }
    const data: Memorial = await res.json();
    setMemorial(data);
    setName(data.name);
    setHebrewName(data.additionalName ?? "");
    setBirthday(toDateInputValue(data.birthday));
    setDateOfDeath(toDateInputValue(data.dateOfDeath));
    setPlaceOfBirth(data.placeOfBirth ?? "");
    setPlaceOfDeath(data.placeOfDeath ?? "");
    setFuneralInfo(data.funeralInfo ?? "");
    setSurvivedBy(data.survivedBy ?? "");
    setLifeStory(data.lifeStory ?? "");
    setProjects(data.projects ?? "");
    setDeathAfterSunset(data.deathAfterSunset);
    setMemorialPictureUrl(data.memorialPicture);
    setEulogies(data.eulogies);
    setLoading(false);
  }, [memorialId]);

  const fetchAlbums = useCallback(async () => {
    const res = await fetch(`/api/memorials/${memorialId}/albums`);
    if (!res.ok) return;
    let data: Album[] = await res.json();

    // Ensure default "Photos" album exists
    if (data.length === 0) {
      const createRes = await fetch(`/api/memorials/${memorialId}/albums`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Photos" }),
      });
      if (createRes.ok) {
        const newAlbum = await createRes.json();
        data = [{ ...newAlbum, images: [] }];
      }
    }

    setAlbums(data);
    const total = data.reduce((sum, a) => sum + a.images.length, 0);
    setTotalImageCount(total);
  }, [memorialId]);

  const fetchMemories = useCallback(async () => {
    const res = await fetch(
      `/api/memorials/${memorialId}/memories?status=ACCEPTED`
    );
    if (res.ok) {
      setMemories(await res.json());
    }
  }, [memorialId]);

  const fetchLinks = useCallback(async () => {
    const res = await fetch(`/api/memorials/${memorialId}/links`);
    if (res.ok) {
      setLinks(await res.json());
    }
  }, [memorialId]);

  useEffect(() => {
    fetchMemorial();
    fetchAlbums();
    fetchMemories();
    fetchLinks();
  }, [fetchMemorial, fetchAlbums, fetchMemories, fetchLinks]);

  // Check ownership
  if (!loading && memorial && session?.user?.id !== memorial.ownerId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-warm-600">
          {t("noPermission")}
        </p>
        <Button
          href={`/memorial/${slug}`}
          variant="ghost"
          size="sm"
          className="mt-4"
        >
          {t("viewMemorial")}
        </Button>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const res = await fetch(`/api/memorials/${memorialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        additionalName: additionalName || null,
        birthday: birthday || null,
        dateOfDeath,
        placeOfBirth,
        placeOfDeath,
        funeralInfo,
        survivedBy,
        lifeStory,
        projects,
        deathAfterSunset,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // If name changed, slug changed — redirect to new URL
      if (updated.slug !== slug) {
        router.replace(`/memorial/${updated.slug}/edit`);
      }
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  async function handleAddEulogy(data: {
    text: string;
    deliveredBy: string;
    relation: string;
  }) {
    const res = await fetch(`/api/memorials/${memorialId}/eulogies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const eulogy = await res.json();
      setEulogies((prev) => [...prev, eulogy]);
      setShowEulogyForm(false);
    }
  }

  async function handleUpdateEulogy(
    eulogyId: string,
    data: { text: string; deliveredBy: string; relation: string }
  ) {
    const res = await fetch(
      `/api/memorials/${memorialId}/eulogies/${eulogyId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (res.ok) {
      const updated = await res.json();
      setEulogies((prev) =>
        prev.map((e) => (e.id === eulogyId ? updated : e))
      );
      setEditingEulogyId(null);
    }
  }

  async function handleDeleteEulogy(eulogyId: string) {
    const res = await fetch(
      `/api/memorials/${memorialId}/eulogies/${eulogyId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setEulogies((prev) => prev.filter((e) => e.id !== eulogyId));
    }
  }

  async function handleMoveEulogy(eulogyId: string, direction: "up" | "down") {
    const index = eulogies.findIndex((e) => e.id === eulogyId);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === eulogies.length - 1)
    ) {
      return;
    }

    const newEulogies = [...eulogies];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newEulogies[index], newEulogies[swapIndex]] = [
      newEulogies[swapIndex],
      newEulogies[index],
    ];
    setEulogies(newEulogies);

    await fetch(`/api/memorials/${memorialId}/eulogies/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eulogyIds: newEulogies.map((e) => e.id) }),
    });
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkError("");
    if (!newLinkUrl.trim()) return;
    setAddingLink(true);
    const res = await fetch(`/api/memorials/${memorialId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newLinkUrl.trim(), title: newLinkTitle.trim() }),
    });
    if (res.ok) {
      setNewLinkTitle("");
      setNewLinkUrl("");
      fetchLinks();
    } else {
      const data = await res.json();
      setLinkError(data.error || "Failed to add link");
    }
    setAddingLink(false);
  }

  async function handleDeleteLink(linkId: string) {
    await fetch(`/api/memorials/${memorialId}/links/${linkId}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  async function handleCreateAlbum() {
    if (!newAlbumName.trim()) return;
    const res = await fetch(`/api/memorials/${memorialId}/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAlbumName.trim() }),
    });
    if (res.ok) {
      setNewAlbumName("");
      fetchAlbums();
    }
  }

  function handleAlbumDragStart(e: React.DragEvent, index: number) {
    setAlbumDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "album");
  }

  function handleAlbumDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setAlbumDropIndex(index);
  }

  async function handleAlbumDragEnd() {
    if (
      albumDragIndex === null ||
      albumDropIndex === null ||
      albumDragIndex === albumDropIndex
    ) {
      setAlbumDragIndex(null);
      setAlbumDropIndex(null);
      return;
    }

    const reordered = [...albums];
    const [moved] = reordered.splice(albumDragIndex, 1);
    reordered.splice(albumDropIndex, 0, moved);
    setAlbums(reordered);

    setAlbumDragIndex(null);
    setAlbumDropIndex(null);

    await fetch(`/api/memorials/${memorialId}/albums/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumIds: reordered.map((a) => a.id) }),
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (error && !memorial) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <SectionHeading
          title={t("title")}
          subtitle={memorial?.name}
          as="h1"
          align="start"
        />
        <Button
          href={`/memorial/${memorial?.slug ?? slug}`}
          variant="ghost"
          size="sm"
        >
          {t("viewPage")}
        </Button>
      </div>

      <div className="space-y-8">
        {/* General Info */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            {t("generalInfo")}
          </h2>

          {/* Memorial Picture */}
          <div className="mt-4 flex justify-center">
            <MemorialPictureUploader
              memorialId={memorialId}
              currentPictureUrl={memorialPictureUrl}
              onUpdate={(url) => setMemorialPictureUrl(url)}
            />
          </div>

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="edit-name"
                className="block text-sm font-medium text-warm-700"
              >
                {t("nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="edit-hebrew-name"
                className="block text-sm font-medium text-warm-700"
              >
                {t("additionalNameLabel")}
              </label>
              <input
                id="edit-hebrew-name"
                type="text"
                value={additionalName}
                onChange={(e) => setHebrewName(e.target.value)}
                className={inputClass}
                placeholder={t("additionalNamePlaceholder")}
                dir="rtl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-birthday"
                  className="block text-sm font-medium text-warm-700"
                >
                  {t("birthdayLabel")}
                </label>
                <input
                  id="edit-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-place-of-birth"
                  className="block text-sm font-medium text-warm-700"
                >
                  {t("placeOfBirthLabel")}
                </label>
                <input
                  id="edit-place-of-birth"
                  type="text"
                  value={placeOfBirth}
                  onChange={(e) => setPlaceOfBirth(e.target.value)}
                  className={inputClass}
                  placeholder={t("placeOfBirthPlaceholder")}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-date-of-death"
                  className="block text-sm font-medium text-warm-700"
                >
                  {t("dateOfDeathLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-date-of-death"
                  type="date"
                  value={dateOfDeath}
                  onChange={(e) => setDateOfDeath(e.target.value)}
                  required
                  className={inputClass}
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-warm-700">
                  <input
                    type="checkbox"
                    checked={deathAfterSunset}
                    onChange={(e) => setDeathAfterSunset(e.target.checked)}
                    className="rounded border-border accent-accent"
                  />
                  {t("deathAfterSunset")}
                </label>
              </div>
              <div>
                <label
                  htmlFor="edit-place-of-death"
                  className="block text-sm font-medium text-warm-700"
                >
                  {t("placeOfDeathLabel")}
                </label>
                <input
                  id="edit-place-of-death"
                  type="text"
                  value={placeOfDeath}
                  onChange={(e) => setPlaceOfDeath(e.target.value)}
                  className={inputClass}
                  placeholder={t("placeOfDeathPlaceholder")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-funeral-info"
                className="block text-sm font-medium text-warm-700"
              >
                {t("funeralInfoLabel")}
              </label>
              <textarea
                id="edit-funeral-info"
                value={funeralInfo}
                onChange={(e) => setFuneralInfo(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder={t("funeralInfoPlaceholder")}
              />
            </div>

            <div>
              <label
                htmlFor="edit-survived-by"
                className="block text-sm font-medium text-warm-700"
              >
                {t("survivedByLabel")}
              </label>
              <textarea
                id="edit-survived-by"
                value={survivedBy}
                onChange={(e) => setSurvivedBy(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder={t("survivedByPlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-700">
                {t("lifeStoryLabel")}
              </label>
              <RichTextEditor
                value={lifeStory}
                onChange={setLifeStory}
                placeholder={t("lifeStoryPlaceholder")}
              />
            </div>

            <div>
              <label
                htmlFor="edit-projects"
                className="block text-sm font-medium text-warm-700"
              >
                {t("projectsLabel")}
              </label>
              <textarea
                id="edit-projects"
                value={projects}
                onChange={(e) => setProjects(e.target.value)}
                rows={4}
                className={inputClass}
                placeholder={t("projectsPlaceholder")}
              />
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center gap-3 rounded-b-xl border-t border-border bg-surface/95 px-6 py-3 backdrop-blur-sm">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
              >
                {saving ? t("saving") : t("saveChanges")}
              </Button>
              {saved && (
                <span className="text-sm font-medium text-gold-600">{t("saved")}</span>
              )}
              {error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
            </div>
          </form>
        </Card>

        {/* Eulogies */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              {t("eulogies")}
            </h2>
            {!showEulogyForm && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEulogyForm(true)}
              >
                {t("addEulogy")}
              </Button>
            )}
          </div>

          {showEulogyForm && (
            <div className="mt-4 rounded-lg border border-border p-4">
              <EulogyForm
                onSave={handleAddEulogy}
                onCancel={() => setShowEulogyForm(false)}
              />
            </div>
          )}

          {eulogies.length === 0 && !showEulogyForm && (
            <p className="mt-4 text-sm text-muted">
              {t("noEulogies")}
            </p>
          )}

          <div className="mt-4 space-y-4">
            {eulogies.map((eulogy, index) => (
              <div
                key={eulogy.id}
                className="rounded-lg border border-border p-4"
              >
                {editingEulogyId === eulogy.id ? (
                  <EulogyForm
                    initialData={{
                      text: eulogy.text,
                      deliveredBy: eulogy.deliveredBy,
                      relation: eulogy.relation ?? "",
                    }}
                    onSave={(data) => handleUpdateEulogy(eulogy.id, data)}
                    onCancel={() => setEditingEulogyId(null)}
                  />
                ) : (
                  <>
                    <p className="line-clamp-3 text-sm text-warm-700">
                      {eulogy.text}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium text-warm-800">
                        {eulogy.deliveredBy}
                      </span>
                      {eulogy.relation && (
                        <span className="text-warm-400">
                          {" "}
                          — {eulogy.relation}
                        </span>
                      )}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingEulogyId(eulogy.id)}
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteEulogy(eulogy.id)}
                      >
                        {t("delete")}
                      </Button>
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveEulogy(eulogy.id, "up")}
                          aria-label="Move up"
                        >
                          &uarr;
                        </Button>
                      )}
                      {index < eulogies.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveEulogy(eulogy.id, "down")}
                          aria-label="Move down"
                        >
                          &darr;
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Links */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            {t("linksTitle")}
          </h2>

          {links.length === 0 && (
            <p className="mt-4 text-sm text-muted">{t("linksNoLinks")}</p>
          )}

          {links.length > 0 && (
            <div className="mt-4 space-y-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-warm-800">
                      {link.title}
                    </p>
                    <p className="truncate text-xs text-warm-400">{link.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteLink(link.id)}
                  >
                    {t("linksDelete")}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddLink} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="new-link-title"
                className="block text-sm font-medium text-warm-700"
              >
                {t("linksAddTitle")}
              </label>
              <input
                id="new-link-title"
                type="text"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                placeholder={t("linksAddTitlePlaceholder")}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="new-link-url"
                className="block text-sm font-medium text-warm-700"
              >
                {t("linksAddUrl")}
              </label>
              <input
                id="new-link-url"
                type="url"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder={t("linksAddUrlPlaceholder")}
                className={inputClass}
              />
            </div>
            {linkError && (
              <p className="text-sm text-red-600">{linkError}</p>
            )}
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={addingLink || !newLinkUrl.trim()}
            >
              {addingLink ? t("linksAdding") : t("linksAdd")}
            </Button>
          </form>
        </Card>

        {/* Photo Gallery */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              {t("photoGallery")}
            </h2>
            <p className="text-sm text-warm-400">
              {t("imageCount", { count: totalImageCount })}
            </p>
          </div>

          {albums.length > 1 && (
            <p className="mt-2 text-xs text-warm-400">
              {t("dragAlbumsHint")}
            </p>
          )}

          {/* Albums */}
          <div className="mt-4 space-y-6">
            {albums.map((album, index) => (
              <AlbumSection
                key={album.id}
                album={album}
                images={album.images}
                memorialId={memorialId}
                totalImageCount={totalImageCount}
                onImagesChange={fetchAlbums}
                albumDraggable={albums.length > 1}
                onAlbumDragStart={(e) => handleAlbumDragStart(e, index)}
                onAlbumDragOver={(e) => handleAlbumDragOver(e, index)}
                onAlbumDragEnd={handleAlbumDragEnd}
                isAlbumDragTarget={albumDropIndex === index}
              />
            ))}
          </div>

          {/* Create album */}
          <div className="mt-6 flex items-center gap-2">
            <input
              type="text"
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              placeholder={t("newAlbumPlaceholder")}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-warm-800 placeholder-warm-400 focus:border-accent focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateAlbum();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCreateAlbum}
              disabled={!newAlbumName.trim()}
            >
              {t("createAlbum")}
            </Button>
          </div>
        </Card>

        {/* Accepted Memories */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            {t("acceptedMemories")}
          </h2>
          {memories.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              {t("noAcceptedMemories")}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {memories.map((memory) => (
                <MemoryEditCard
                  key={memory.id}
                  memory={memory}
                  onUpdated={fetchMemories}
                  onDeleted={fetchMemories}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
