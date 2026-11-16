/**
 * Club-wide links. CLUB_PROJECTS mirrors `subsites` in the club website repo
 * (hcmute-dsc.github.io, config/site.js) so both sites list the same projects.
 * When a project is added there, add it here too.
 */
export const CLUB_SITE = 'https://hcmute-dsc.io.vn';

export const CLUB_LINKS = {
  site: CLUB_SITE,
  github: 'https://github.com/hcmute-dsc',
  /** where members contribute lessons and exercises */
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
