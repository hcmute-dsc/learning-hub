import Link from 'next/link';
import { CLUB_LINKS } from '@/lib/club';

/** Decorative code lines, placed like the ones on the club hero. Hidden from screen readers. */
const CODE_LINES = [
  {
    text: '$ git clone https://github.com/hcmute-dsc/learning-hub-content',
    className: 'left-6 top-6',
  },
  { text: 'while (learning) { build(); share(); grow(); }', className: 'left-6 top-16' },
  {
    text: "const hub = { motto: 'Học đi đôi với hành' };",
    className: 'right-6 top-10 hidden md:block',
  },
  { text: "SELECT * FROM lessons WHERE status = 'published';", className: 'left-6 bottom-14' },
  {
    text: "> git commit -m 'Xong bài tập đầu tiên'",
    className: 'right-6 bottom-6 hidden md:block',
  },
];

/**
 * Full-width navy hero in the club style (see `.hero-code-bg` in globals.css).
 * `w-screen` + `-translate-x-1/2` step outside the page container from layout.tsx,
 * and `-mt-8` cancels the container's top padding.
 */
export function HomeHero() {
  return (
    <section className="hero-code-bg relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden text-white">
      <div aria-hidden>
        {CODE_LINES.map((line) => (
          <p key={line.text} className={`hero-code-line absolute ${line.className}`}>
            {line.text}
          </p>
        ))}
      </div>

      <div className="motion-fade-up relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <p className="font-mono text-sm font-semibold text-brand-500">&gt;DSC_ Learning Hub</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Học đi đôi với hành<span className="text-brand-500">_</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/80">
          Chọn một lộ trình, làm bài tập nhỏ, nộp qua GitHub và nhận góp ý từ anh chị mentor trong
          CLB Sinh viên Lập trình HCMUTE.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/tracks"
            className="press rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Xem lộ trình
          </Link>
          <a
            href={CLUB_LINKS.site}
            className="rounded-lg border border-white/40 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Website CLB
          </a>
        </div>
      </div>
    </section>
  );
}
