import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseIdFromSlug } from "@/lib/slug";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { getHebrewDeathDate } from "@/lib/hebrewDate";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import CollapsibleText from "@/components/ui/CollapsibleText";
import GalleryView from "@/components/memorial/GalleryView";
import MemoryCard from "@/components/memorial/MemoryCard";
import MemorySubmissionForm from "@/components/memorial/MemorySubmissionForm";
import YahrzeitCalendar from "@/components/memorial/YahrzeitCalendar";
import PosterDownload from "@/components/memorial/PosterDownload";
import MemorialNav from "@/components/memorial/MemorialNav";
import FollowButton from "@/components/memorial/FollowButton";
import RichTextContent from "@/components/ui/RichTextContent";
import CollapsibleRichText from "@/components/ui/CollapsibleRichText";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

async function checkDisabled(slug: string) {
  const id = parseIdFromSlug(slug);
  const row = await prisma.memorial.findUnique({
    where: { id },
    select: { disabled: true, name: true, slug: true },
  });
  if (!row) return null;
  if (row.disabled) return { disabled: true as const, name: row.name, slug: row.slug };
  return false as const;
}

async function getMemorial(slug: string) {
  const id = parseIdFromSlug(slug);
  const memorial = await prisma.memorial.findUnique({
    where: { id },
    include: {
      eulogies: { orderBy: { order: "asc" } },
      albums: {
        orderBy: { order: "asc" },
        include: {
          images: { orderBy: { order: "asc" } },
        },
      },
      owner: { select: { id: true, name: true } },
      memories: {
        where: { status: "ACCEPTED" },
        orderBy: { createdAt: "asc" },
        include: { images: true },
      },
    },
  });

  if (!memorial) return null;

  // Resolve presigned URLs
  let memorialPictureUrl: string | null = null;
  if (memorial.memorialPicture) {
    memorialPictureUrl = await generateViewUrl(memorial.memorialPicture);
  }

  const albumsWithUrls = await Promise.all(
    memorial.albums.map(async (album) => ({
      ...album,
      images: await Promise.all(
        album.images.map(async (img) => {
          if (img.mediaType === "VIDEO") {
            const url = await generateViewUrl(img.s3Key);
            return { ...img, thumbUrl: url, url };
          }
          return {
            ...img,
            thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
            url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
          };
        })
      ),
    }))
  );

  const memoriesWithUrls = await Promise.all(
    memorial.memories.map(async (memory) => ({
      ...memory,
      createdAt: memory.createdAt.toISOString(),
      images: await Promise.all(
        memory.images.map(async (img) => {
          if (img.mediaType === "VIDEO") {
            const url = await generateViewUrl(img.s3Key);
            return { ...img, thumbUrl: url, url };
          }
          return {
            ...img,
            thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
            url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
          };
        })
      ),
    }))
  );

  return {
    ...memorial,
    memorialPictureUrl,
    albums: albumsWithUrls,
    memories: memoriesWithUrls,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const disabledCheck = await checkDisabled(slug);
  if (disabledCheck === null) {
    return { title: "Memorial Not Found" };
  }
  if (disabledCheck !== false) {
    return { title: `${disabledCheck.name} — Memorial Unavailable` };
  }

  const memorial = await getMemorial(slug);

  if (!memorial) {
    return { title: "Memorial Not Found" };
  }

  const title = `${memorial.name} — Forever Memorial`;
  const description = `Memorial page for ${memorial.name}.${memorial.placeOfDeath ? ` ${memorial.placeOfDeath}.` : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(memorial.memorialPictureUrl && {
        images: [{ url: memorial.memorialPictureUrl }],
      }),
    },
  };
}

function formatDate(date: Date | null | undefined, locale: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function MemorialPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Memorial");

  // Check disabled status with a lightweight query first
  const disabledCheck = await checkDisabled(slug);
  if (disabledCheck === null) {
    notFound();
  }
  if (disabledCheck !== false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <Card>
          <h1 className="font-heading text-2xl font-semibold text-warm-800">
            {t("disabledTitle")}
          </h1>
          <p className="mt-4 text-warm-600">{t("disabledMessage")}</p>
          <div className="mt-6">
            <Link
              href="/"
              className="text-sm text-accent hover:text-accent-hover"
            >
              &larr; {t("backHome")}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const memorial = await getMemorial(slug);

  if (!memorial) {
    notFound();
  }

  // Redirect to canonical slug if URL doesn't match
  if (memorial.slug !== slug) {
    redirect(`/memorial/${memorial.slug}`);
  }

  const session = await auth();
  const isOwner = session?.user?.id === memorial.ownerId;
  const isLoggedIn = !!session?.user?.id;

  const [links, followRecord] = await Promise.all([
    prisma.memorialLink.findMany({
      where: { memorialId: memorial.id },
      orderBy: { order: "asc" },
    }),
    isLoggedIn && !isOwner
      ? prisma.memorialFollow.findUnique({
          where: { userId_memorialId: { userId: session!.user!.id, memorialId: memorial.id } },
          select: { userId: true },
        })
      : null,
  ]);

  const isFollowing = !!followRecord;

  // Prepare gallery data — only albums with images
  const galleryAlbums = memorial.albums
    .filter((a) => a.images.length > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      images: a.images.map((img) => ({
        id: img.id,
        thumbUrl: img.thumbUrl,
        url: img.url,
        caption: img.caption,
        mediaType: img.mediaType as "IMAGE" | "VIDEO",
      })),
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: memorial.name,
    ...(memorial.birthday && {
      birthDate: new Date(memorial.birthday).toISOString().split("T")[0],
    }),
    deathDate: new Date(memorial.dateOfDeath).toISOString().split("T")[0],
    ...(memorial.placeOfDeath && {
      deathPlace: {
        "@type": "Place",
        name: memorial.placeOfDeath,
      },
    }),
  };

  const navSections = [
    { id: "details", label: t("details") },
    ...(memorial.funeralInfo ? [{ id: "funeral-info", label: t("funeralInfo") }] : []),
    ...(memorial.survivedBy ? [{ id: "survived-by", label: t("survivedBy") }] : []),
    ...(memorial.lifeStory ? [{ id: "life-story", label: t("lifeStory") }] : []),
    ...(memorial.projects ? [{ id: "projects", label: t("navProjects") }] : []),
    ...(links.length > 0 ? [{ id: "links", label: t("links") }] : []),
    ...(galleryAlbums.length > 0 ? [{ id: "photos", label: t("photos") }] : []),
    ...(memorial.eulogies.length > 0 ? [{ id: "eulogies", label: t("eulogies") }] : []),
    ...(memorial.memories.length > 0 ? [{ id: "memories", label: t("memories") }] : []),
    { id: "share-memory", label: t("shareMemory"), isCta: true },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-center">
          {/* Memorial picture — hidden when no image */}
          {memorial.memorialPictureUrl && (
            <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl bg-warm-200 sm:w-[55%]">
              <img
                src={memorial.memorialPictureUrl}
                alt={memorial.name}
                className="size-full object-cover"
              />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-semibold text-warm-800 sm:text-4xl">
              {memorial.name}
            </h1>

            {memorial.additionalName && (
              <p className="mt-1 font-heading text-xl text-warm-600">
                <span dir="rtl">{memorial.additionalName}</span>
              </p>
            )}

            <p className="mt-2 text-base text-muted">
              <span className="whitespace-nowrap">{formatDate(memorial.dateOfDeath, locale)}</span>
              {" · "}
              <span className="whitespace-nowrap" dir="rtl">
                {getHebrewDeathDate(memorial.dateOfDeath, memorial.deathAfterSunset, "he")}
              </span>
            </p>

            {memorial.placeOfDeath && (
              <p className="mt-1 text-sm text-warm-400">
                {memorial.placeOfDeath}
              </p>
            )}

            {/* Leaf separator */}
            <div className="mt-5" aria-hidden="true">
              <svg className="mx-auto h-4 w-auto text-gold-400" viewBox="0 0 80 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Left line */}
                <line x1="0" y1="6" x2="24" y2="6" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                {/* Leaf — lying on its side */}
                <path
                  d="M30 6 Q40 0 50 6 Q40 12 30 6z"
                  fill="currentColor"
                  opacity="0.3"
                />
                {/* Leaf midrib */}
                <line x1="31" y1="6" x2="49" y2="6" stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
                {/* Leaf veins */}
                <line x1="36" y1="6" x2="34" y2="3.5" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
                <line x1="40" y1="6" x2="38" y2="2.8" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
                <line x1="44" y1="6" x2="42.5" y2="3.2" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
                <line x1="36" y1="6" x2="34" y2="8.5" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
                <line x1="40" y1="6" x2="38" y2="9.2" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
                <line x1="44" y1="6" x2="42.5" y2="8.8" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
                {/* Right line */}
                <line x1="56" y1="6" x2="80" y2="6" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              </svg>
            </div>

            {(isOwner || (isLoggedIn && !isOwner)) && (
              <div className="mt-4 flex flex-col items-center gap-3">
                {isOwner && (
                  <>
                    <Button
                      href={`/memorial/${memorial.slug}/edit`}
                      variant="secondary"
                      size="sm"
                    >
                      {t("editMemorial")}
                    </Button>
                    <PosterDownload memorialId={memorial.id} label={t("posterLabel")} />
                  </>
                )}
                {!isOwner && (
                  <FollowButton
                    memorialId={memorial.id}
                    initialFollowing={isFollowing}
                  />
                )}
              </div>
            )}
          </div>
        </header>

        <MemorialNav sections={navSections} />

        <div className="mt-12 space-y-8">
          {/* Details */}
          <Card id="details" className="scroll-mt-28">
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              {t("details")}
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {memorial.birthday && (
                <div>
                  <dt className="font-medium text-warm-600">{t("born")}</dt>
                  <dd className="mt-0.5 text-warm-800">
                    {formatDate(memorial.birthday, locale)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-warm-600">{t("passedAway")}</dt>
                <dd className="mt-0.5 flex items-center text-warm-800">
                  {formatDate(memorial.dateOfDeath, locale)}
                  {" / "}
                  {getHebrewDeathDate(
                    memorial.dateOfDeath,
                    memorial.deathAfterSunset,
                    locale === "he" ? "he" : "en"
                  )}
                  <YahrzeitCalendar
                    memorialId={memorial.id}
                    memorialName={memorial.name}
                  />
                </dd>
              </div>
              {memorial.placeOfDeath && (
                <div>
                  <dt className="font-medium text-warm-600">
                    {t("placeOfDeath")}
                  </dt>
                  <dd className="mt-0.5 text-warm-800">
                    {memorial.placeOfDeath}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Funeral info */}
          {memorial.funeralInfo && (
            <Card id="funeral-info" className="scroll-mt-28">
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("funeralInfo")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
                {memorial.funeralInfo}
              </p>
            </Card>
          )}

          {/* Survived by */}
          {memorial.survivedBy && (
            <Card id="survived-by" className="scroll-mt-28">
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("survivedBy")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
                {memorial.survivedBy}
              </p>
            </Card>
          )}

          {/* Life story */}
          {memorial.lifeStory && (
            <Card id="life-story" className="scroll-mt-28">
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("lifeStory")}
              </h2>
              <CollapsibleRichText html={memorial.lifeStory} className="mt-3" />
            </Card>
          )}

          {/* Memorial projects & charities */}
          {memorial.projects && (
            <Card id="projects" className="scroll-mt-28">
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("projects")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
                {memorial.projects}
              </p>
            </Card>
          )}

          {/* External links */}
          {links.length > 0 && (
            <section id="links" className="scroll-mt-28">
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("links")}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {links.map((link) => {
                  const domain = (() => {
                    try { return new URL(link.url).hostname.replace(/^www\./, ""); }
                    catch { return link.url; }
                  })();
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-start gap-3 overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent hover:bg-warm-50"
                    >
                      {link.imageUrl ? (
                        <img
                          src={link.imageUrl}
                          alt=""
                          className="size-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=48`}
                          alt=""
                          className="size-12 shrink-0 rounded-lg bg-warm-100 object-contain p-2"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-warm-800">
                          {link.title}
                        </p>
                        {link.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-warm-500">
                            {link.description}
                          </p>
                        )}
                        <p className="mt-1 truncate text-xs text-accent">
                          {domain}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* Photo Gallery */}
          {galleryAlbums.length > 0 && (
            <section id="photos" className="scroll-mt-28">
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("photos")}
              </h2>
              <div className="mt-6">
                <GalleryView albums={galleryAlbums} />
              </div>
            </section>
          )}

          {/* Eulogies */}
          {memorial.eulogies.length > 0 && (
            <section id="eulogies" className="scroll-mt-28">
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("eulogies")}
              </h2>
              <div className="mt-6 space-y-6">
                {memorial.eulogies.map((eulogy) => (
                  <Card key={eulogy.id}>
                    <blockquote className="border-s-4 border-gold-400 ps-4">
                      <CollapsibleText text={eulogy.text} maxLines={8} />
                      <footer className="mt-4 text-sm">
                        <span className="font-medium text-warm-800">
                          {eulogy.deliveredBy}
                        </span>
                        {eulogy.relation && (
                          <span className="text-warm-400">
                            {" "}
                            — {eulogy.relation}
                          </span>
                        )}
                      </footer>
                    </blockquote>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Memories */}
          {memorial.memories.length > 0 && (
            <section id="memories" className="scroll-mt-28">
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("memories")}
              </h2>
              <div className="mt-6 space-y-6">
                {memorial.memories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            </section>
          )}

          {/* Share a Memory */}
          <section id="share-memory" className="scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold text-warm-800">
              {t("shareMemory")}
            </h2>
            {session?.user ? (
              <Card className="mt-6">
                <MemorySubmissionForm memorialId={memorial.id} />
              </Card>
            ) : (
              <Card className="mt-6">
                <p className="text-sm text-warm-600">
                  {t("shareMemoryPrompt", { name: memorial.name })}
                </p>
                <div className="mt-3">
                  <Button
                    href={`/auth/signin?callbackUrl=/memorial/${memorial.slug}`}
                    variant="secondary"
                    size="sm"
                  >
                    {t("signInToShare")}
                  </Button>
                </div>
              </Card>
            )}
          </section>

          {/* Back link */}
          <div className="pt-4 text-center">
            <Link
              href="/"
              className="text-sm text-accent hover:text-accent-hover"
            >
              &larr; {t("backHome")}
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
