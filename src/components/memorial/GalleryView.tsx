"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";
import VideoThumbnail from "./VideoThumbnail";
import ScrollableRow from "./ScrollableRow";

type ImageWithUrl = {
  id: string;
  thumbUrl: string;
  url: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO";
};

type AlbumWithImages = {
  id: string;
  name: string;
  images: ImageWithUrl[];
};

type GalleryViewProps = {
  albums: AlbumWithImages[];
};

export default function GalleryView({ albums }: GalleryViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Flatten all images for lightbox navigation
  const allImages = albums.flatMap((album) => album.images);
  const nonEmptyAlbums = albums.filter((album) => album.images.length > 0);
  const singleAlbum = nonEmptyAlbums.length === 1;

  if (allImages.length === 0) return null;

  // Calculate global index for an image
  function getGlobalIndex(albumIndex: number, imageIndex: number): number {
    let offset = 0;
    for (let i = 0; i < albumIndex; i++) {
      offset += nonEmptyAlbums[i].images.length;
    }
    return offset + imageIndex;
  }

  return (
    <div>
      <div className="space-y-8">
        {nonEmptyAlbums.map((album, albumIdx) => (
          <div key={album.id}>
            {!singleAlbum && (
              <h3 className="mb-3 font-heading text-base font-semibold text-warm-700">
                {album.name}
              </h3>
            )}
            <ScrollableRow>
              {album.images.map((image, imgIdx) => (
                <button
                  key={image.id}
                  onClick={() =>
                    setLightboxIndex(getGlobalIndex(albumIdx, imgIdx))
                  }
                  className="group relative size-36 shrink-0 overflow-hidden rounded-lg bg-warm-100"
                >
                  {image.mediaType === "VIDEO" ? (
                    <VideoThumbnail
                      src={image.thumbUrl}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                      draggable={false}
                    />
                  ) : (
                    <img
                      src={image.thumbUrl}
                      alt={image.caption || "Gallery image"}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                  {image.mediaType === "VIDEO" && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-black/50 p-1.5">
                        <svg className="size-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4 2l10 6-10 6z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {image.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-xs text-white">
                        {image.caption}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </ScrollableRow>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={allImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
