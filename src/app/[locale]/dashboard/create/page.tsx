"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

export default function CreateMemorialPage() {
  const router = useRouter();
  const t = useTranslations("CreateMemorial");
  const [name, setName] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [birthday, setBirthday] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [funeralInfo, setFuneralInfo] = useState("");
  const [survivedBy, setSurvivedBy] = useState("");
  const [lifeStory, setLifeStory] = useState("");
  const [deathAfterSunset, setDeathAfterSunset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/memorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        dateOfDeath,
        birthday: birthday || undefined,
        placeOfDeath: placeOfDeath || undefined,
        funeralInfo: funeralInfo || undefined,
        survivedBy: survivedBy || undefined,
        lifeStory: lifeStory || undefined,
        deathAfterSunset,
      }),
    });

    if (res.ok) {
      const memorial = await res.json();
      router.push(`/memorial/${memorial.slug}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create memorial");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        title={t("title")}
        subtitle={t("subtitle")}
        as="h1"
        align="start"
      />

      <div className="mt-10">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="create-name"
                className="block text-sm font-medium text-warm-700"
              >
                {t("nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="create-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="create-birthday"
                  className="block text-sm font-medium text-warm-700"
                >
                  {t("birthdayLabel")}
                </label>
                <input
                  id="create-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="create-date-of-death"
                  className="block text-sm font-medium text-warm-700"
                >
                  {t("dateOfDeathLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  id="create-date-of-death"
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
            </div>

            <div>
              <label
                htmlFor="create-place-of-death"
                className="block text-sm font-medium text-warm-700"
              >
                {t("placeOfDeathLabel")}
              </label>
              <input
                id="create-place-of-death"
                type="text"
                value={placeOfDeath}
                onChange={(e) => setPlaceOfDeath(e.target.value)}
                className={inputClass}
                placeholder={t("placeOfDeathPlaceholder")}
              />
            </div>

            <div>
              <label
                htmlFor="create-funeral-info"
                className="block text-sm font-medium text-warm-700"
              >
                {t("funeralInfoLabel")}
              </label>
              <textarea
                id="create-funeral-info"
                value={funeralInfo}
                onChange={(e) => setFuneralInfo(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder={t("funeralInfoPlaceholder")}
              />
            </div>

            <div>
              <label
                htmlFor="create-survived-by"
                className="block text-sm font-medium text-warm-700"
              >
                {t("survivedByLabel")}
              </label>
              <textarea
                id="create-survived-by"
                value={survivedBy}
                onChange={(e) => setSurvivedBy(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder={t("survivedByPlaceholder")}
              />
            </div>

            <div>
              <label
                htmlFor="create-life-story"
                className="block text-sm font-medium text-warm-700"
              >
                {t("lifeStoryLabel")}
              </label>
              <textarea
                id="create-life-story"
                value={lifeStory}
                onChange={(e) => setLifeStory(e.target.value)}
                rows={6}
                className={inputClass}
                placeholder={t("lifeStoryPlaceholder")}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={saving}
              >
                {saving ? t("creating") : t("create")}
              </Button>
              <Button href="/dashboard" variant="ghost" size="lg">
                {t("cancel")}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
