import { Avatar } from '@/components/ui/Avatar';
import { initials } from './board';

/** GitHub avatar, or the member's initials when there is none (learning-hub#88). */
export function MemberAvatar({
  src,
  name,
  size,
}: {
  src: string | null;
  name: string;
  size: number;
}) {
  if (src) return <Avatar src={src} size={size} />;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--code-bg)] font-bold text-[var(--muted)]"
      style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
    >
      {initials(name)}
    </span>
  );
}
