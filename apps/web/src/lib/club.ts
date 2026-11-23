/**
 * Club-wide links. CLUB_PROJECTS mirrors `subsites` in the club website repo
 * (hcmute-dsc.github.io, config/site.js) so both sites list the same projects.
 * When a project is added there, add it here too.
 */
export const CLUB_SITE = 'https://hcmute-dsc.io.vn';

/** The club's short name. Always the full "HCMUTE DSC" in text, never "DSC" alone (learning-hub#110). */
export const CLUB_SHORT_NAME = 'HCMUTE DSC';

/** Name of this site: tab titles, home page, logo label. */
export const SITE_NAME = `${CLUB_SHORT_NAME} Learning Hub`;

export const CLUB_LINKS = {
  site: CLUB_SITE,
  github: 'https://github.com/hcmute-dsc',
  /** how to contribute: lessons, new tracks, code (learning-hub#28) */
  contribute: '/contribute',
  /** club code of conduct; GitHub applies it to every org repo (learning-hub-docs#51) */
  conduct: 'https://github.com/hcmute-dsc/.github/blob/master/CODE_OF_CONDUCT.md',
  /** registry of tracks (ADR-10); each track lives in its own repo */
  content: 'https://github.com/hcmute-dsc/learning-hub-content',
};

export interface ClubProject {
  label: string;
  icon: string;
  description: string;
  href: string;
}

export const CLUB_PROJECTS: ClubProject[] = [
  {
    label: 'Memoryland',
    icon: '🕰️',
    description: 'Kho ký ức số kỷ niệm 5 năm: hành trình qua từng năm và các thế hệ Ban Chủ nhiệm.',
    href: 'https://memoryland.hcmute-dsc.io.vn',
  },
  {
    label: 'SQL Challenge',
    icon: '🗄️',
    description: 'Thử thách 30 ngày học SQL với PostgreSQL: bài học, sơ đồ và bài tập.',
    href: 'https://sql-challenge.hcmute-dsc.io.vn',
  },
  {
    label: 'Mentoring',
    icon: '🤝',
    description: 'Chương trình mentoring kết nối thành viên với anh chị đi trước.',
    href: 'https://mentoring.hcmute-dsc.io.vn',
  },
  {
    label: 'IT Quiz',
    icon: '🧠',
    description: 'Ôn tập kiến thức IT: trắc nghiệm, thi thử, chạy offline.',
    href: 'https://it-quiz.hcmute-dsc.io.vn',
  },
  {
    label: 'Club Day',
    icon: '🎮',
    description: 'Mini game realtime cho sự kiện CLB, tham gia bằng mã QR.',
    href: 'https://club-day.hcmute-dsc.io.vn',
  },
];
