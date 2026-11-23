import { CLUB_LINKS } from '@/lib/club';

/** Navy footer band, like the anniversary band on the club website. */
export function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy-900 text-sm text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-white">HCMUTE Developer Student Club</span> · Học đi
          đôi với hành
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li>
            <a className="hover:text-white hover:underline" href={CLUB_LINKS.site}>
              Website CLB
            </a>
          </li>
          <li>
            <a className="hover:text-white hover:underline" href={CLUB_LINKS.contribute}>
              Đóng góp nội dung
            </a>
          </li>
          <li>
            <a className="hover:text-white hover:underline" href={CLUB_LINKS.conduct}>
              Quy tắc ứng xử
            </a>
          </li>
          <li>
            <a className="hover:text-white hover:underline" href={CLUB_LINKS.github}>
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
