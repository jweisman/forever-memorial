"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { parseIdFromSlug } from "@/lib/slug";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
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
  url: string;
};

type Album = {
  id: string;
  name: string;
  images: ImageRecord[];
};

type Memorial = {
  id: string;
  slug: string;
  name: string;
  birthday: string | null;
  dateOfDeath: string;
  placeOfDeath: string | null;
  funeralInfo: string | null;
  survivedBy: string | null;
  lifeStory: string | null;
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
  const memorialId = parseIdFromSlug(slug);

  const [memorial, setMemorial] = useState<Memorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [funeralInfo, setFuneralInfo] = useState("");
  const [survivedBy, setSurvivedBy] = useState("");
  const [lifeStory, setLifeStory] = useState("");

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
    images: { id: string; url: string; caption: string | null }[];
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
    setBirthday(toDateInputValue(data.birthday));
    setDateOfDeath(toDateInputValue(data.dateOfDeath));
    setPlaceOfDeath(data.placeOfDeath ?? "");
    setFuneralInfo(data.funeralInfo ?? "");
    setSurvivedBy(data.survivedBy ?? "");
    setLifeStory(data.lifeStory ?? "");
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

  useEffect(() => {
    fetchMemorial();
    fetchAlbums();
    fetchMemories();
  }, [fetchMemorial, fetchAlbums, fetchMemories]);

  // Check ownership
  if (!loading && memorial && session?.user?.id !== memorial.ownerId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-warm-600">
          You don&apos;t have permission to edit this memorial.
        </p>
        <Button
          href={`/memorial/${slug}`}
          variant="ghost"
          size="sm"
          className="mt-4"
        >
          View memorial
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
        birthday: birthday || null,
        dateOfDeath,
        placeOfDeath,
        funeralInfo,
        survivedBy,
        lifeStory,
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
          title="Edit Memorial"
          subtitle={memorial?.name}
          as="h1"
          align="start"
        />
        <Button
          href={`/memorial/${memorial?.slug ?? slug}`}
          variant="ghost"
          size="sm"
        >
          View page
        </Button>
      </div>

      <div className="space-y-8">
        {/* General Info */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            General Information
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
                Name <span className="text-red-500">*</span>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-birthday"
                  className="block text-sm font-medium text-warm-700"
                >
                  Birthday
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
                  htmlFor="edit-date-of-death"
                  className="block text-sm font-medium text-warm-700"
                >
                  Date of death <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-date-of-death"
                  type="date"
                  value={dateOfDeath}
                  onChange={(e) => setDateOfDeath(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-place-of-death"
                className="block text-sm font-medium text-warm-700"
              >
                Place of death
              </label>
              <input
                id="edit-place-of-death"
                type="text"
                value={placeOfDeath}
                onChange={(e) => setPlaceOfDeath(e.target.value)}
                className={inputClass}
                placeholder="e.g. Jerusalem, Israel"
              />
            </div>

            <div>
              <label
                htmlFor="edit-funeral-info"
                className="block text-sm font-medium text-warm-700"
              >
                Funeral information
              </label>
              <textarea
                id="edit-funeral-info"
                value={funeralInfo}
                onChange={(e) => setFuneralInfo(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Details about funeral arrangements..."
              />
            </div>

            <div>
              <label
                htmlFor="edit-survived-by"
                className="block text-sm font-medium text-warm-700"
              >
                Survived by
              </label>
              <textarea
                id="edit-survived-by"
                value={survivedBy}
                onChange={(e) => setSurvivedBy(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Family members..."
              />
            </div>

            <div>
              <label
                htmlFor="edit-life-story"
                className="block text-sm font-medium text-warm-700"
              >
                Life story
              </label>
              <textarea
                id="edit-life-story"
                value={lifeStory}
                onChange={(e) => setLifeStory(e.target.value)}
                rows={8}
                className={inputClass}
                placeholder="Tell the story of their life..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
              {saved && (
                <span className="text-sm text-gold-600">Saved!</span>
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
              Eulogies
            </h2>
            {!showEulogyForm && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEulogyForm(true)}
              >
                Add Eulogy
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
              No eulogies have been added yet.
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
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteEulogy(eulogy.id)}
                      >
                        Delete
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

        {/* Photo Gallery */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              Photo Gallery
            </h2>
            <p className="text-sm text-warm-400">
              {totalImageCount} / 100 images
            </p>
          </div>

          {albums.length > 1 && (
            <p className="mt-2 text-xs text-warm-400">
              Drag albums to reorder
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
              placeholder="New album name..."
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
              Create Album
            </Button>
          </div>
        </Card>

        {/* Accepted Memories */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            Accepted Memories
          </h2>
          {memories.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No accepted memories yet.
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
