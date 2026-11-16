import { CardGrid, type CardItem } from '@/components/home/CardGrid';
import { HomeHero } from '@/components/home/HomeHero';
import { CLUB_LINKS, CLUB_PROJECTS } from '@/lib/club';

const HOW_IT_WORKS: CardItem[] = [
  {
    icon: '📖',
    title: '1. Học',
    description: 'Bài ngắn, có mục tiêu rõ ràng, đọc tốt trên điện thoại.',
  },
  {
    icon: '🛠️',
    title: '2. Làm',
    description: 'Quiz, bài tự kiểm tra, hoặc bài code nộp bằng pull request trên GitHub của bạn.',
  },
  {
    icon: '🤝',
    title: '3. Nhận góp ý',
    description: 'Chấm tự động và nhận xét từ anh chị mentor trong CLB.',
  },
];

const TRACKS: CardItem[] = [
  {
    icon: '🗄️',
    title: '30 ngày học SQL',
    description:
      'Từ SELECT tới index, transaction và window function với PostgreSQL 16. 32 bài học, dự án cuối khóa.',
    link: { href: '/tracks/sql-30-days', label: 'Bắt đầu học' },
  },
  {
    icon: '✍️',
    title: 'Viết thêm lộ trình',
    description: 'Nội dung do chính thành viên CLB viết và review bằng pull request.',
    link: { href: CLUB_LINKS.content, label: 'Đóng góp nội dung' },
  },
];

const PROJECTS: CardItem[] = CLUB_PROJECTS.map((p) => ({
  icon: p.icon,
  title: p.label,
  description: p.description,
  link: { href: p.href, label: new URL(p.href).host },
}));

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <CardGrid id="how-it-works" title="Học theo cách của DSC" items={HOW_IT_WORKS} />
      <CardGrid
        id="tracks"
        title="Lộ trình"
        intro="Đăng nhập bằng GitHub để tham gia và lưu tiến độ."
        items={TRACKS}
      />
      <CardGrid id="club-projects" title="Các dự án khác của DSC" items={PROJECTS} />
    </>
  );
}
