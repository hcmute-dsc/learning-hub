import Image from 'next/image';

/**
 * Round GitHub avatar (next.config allows avatars.githubusercontent.com).
 * Members without one get a neutral circle, so layouts do not jump.
 */
export function Avatar({
  src,
  size,
  className = '',
}: {
  src: string | null;
  size: number;
  className?: string;
}) {
  const classes = `shrink-0 rounded-full border border-[var(--border)] ${className}`;
  if (!src) {
    return (
      <span
        aria-hidden
        className={`${classes} bg-[var(--bg)]`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <Image src={src} alt="" width={size} height={size} className={classes} />;
}
