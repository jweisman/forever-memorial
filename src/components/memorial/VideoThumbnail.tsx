/**
 * Renders a muted video thumbnail.
 * The #t=0.001 fragment forces Safari to seek to the first frame and paint it,
 * since Safari does not render a poster frame from preload="metadata" alone.
 */
export default function VideoThumbnail({
  src,
  className,
  draggable,
}: {
  src: string;
  className?: string;
  draggable?: boolean;
}) {
  return (
    <video
      src={`${src}#t=0.001`}
      className={className}
      muted
      playsInline
      preload="metadata"
      draggable={draggable}
    />
  );
}
