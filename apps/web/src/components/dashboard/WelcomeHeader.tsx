import { CLUB_SHORT_NAME } from '@/lib/club';

/**
 * Navy welcome band at the top of the dashboard, in the club hero style
 * (`.hero-code-bg` in globals.css). White text on navy keeps AA contrast in both themes.
 */
export function WelcomeHeader({ name, message }: { name: string; message: string }) {
  return (
    <header className="hero-code-bg motion-fade-up flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white sm:gap-6 sm:p-8">
      {/* The club logo, not a "DSC" text badge: in text the club is always "HCMUTE DSC" (#110).
          The band is always navy, so it always uses the light-on-dark version. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no resizing needed */}
      <img
        src="/brand/hcmute-dsc-mark-dark.png"
        alt={CLUB_SHORT_NAME}
        height={40}
        style={{ height: 40, width: 'auto' }}
        className="motion-pop shrink-0"
      />
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Chào mừng trở lại, {name}!
        </h1>
        <p className="mt-1 text-white/80">{message}</p>
      </div>
    </header>
  );
}
