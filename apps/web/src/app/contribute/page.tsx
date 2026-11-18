import type { Metadata } from 'next';
import { CardGrid, type CardItem } from '@/components/home/CardGrid';
import { CONTRIBUTE_LINKS } from '@/lib/contribute';

export const metadata: Metadata = { title: 'Đóng góp' };

const WAYS: CardItem[] = [
  {
    icon: '✏️',
    title: 'Sửa một bài đang học',
    description:
      'Thấy lỗi chính tả, câu lệnh chạy sai hay đáp án nhầm? Mở bài đó, bấm "Sửa trên GitHub" trên trang bài, sửa rồi mở pull request.',
    link: { href: '/tracks', label: 'Chọn lộ trình' },
  },
  {
    icon: '🐞',
    title: 'Báo lỗi nội dung',
    description:
      'Chưa quen pull request thì mở issue "Lỗi nội dung" trong repo của lộ trình đó: ghi bài nào, sai ở đâu, nên sửa thành gì.',
    link: { href: CONTRIBUTE_LINKS.registryFile, label: 'Danh sách repo các lộ trình' },
  },
  {
    icon: '🧭',
    title: 'Đề xuất lộ trình mới',
    description:
      'Muốn viết C#, Java hay Git? Mở đề xuất, Ban chủ nhiệm tạo repo riêng từ template và cấp quyền cho bạn.',
    link: { href: CONTRIBUTE_LINKS.proposeTrack, label: 'Mở đề xuất' },
  },
  {
    icon: '💻',
    title: 'Đóng góp code',
    description:
      'Learning Hub là mã nguồn mở của CLB (NestJS + Next.js). Đọc hướng dẫn, rồi chọn một issue "good first issue".',
    link: { href: CONTRIBUTE_LINKS.goodFirstIssues, label: 'Việc cho người mới' },
  },
  {
    icon: '🐛',
    title: 'Báo lỗi trang web',
    description:
      'Trang lỗi, nút không chạy, hiển thị sai trên điện thoại: báo để Ban kỹ thuật sửa.',
    link: { href: CONTRIBUTE_LINKS.appBug, label: 'Báo lỗi trang web' },
  },
  {
    icon: '📚',
    title: 'Viết đúng định dạng',
    description:
      'Bài học là Markdown, bài tập là YAML. Đặc tả nội dung ghi từng trường và các lỗi hay gặp.',
    link: { href: CONTRIBUTE_LINKS.contentSpec, label: 'Đặc tả nội dung' },
  },
];

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Có issue trước',
    text: 'Mỗi thay đổi gắn với một issue, để mọi người biết ai đang làm gì.',
  },
  {
    title: 'Mở pull request',
    text: 'Sửa trên nhánh riêng hoặc fork. CI tự kiểm tra định dạng bài.',
  },
  {
    title: 'Được review',
    text: 'Người phụ trách lộ trình đọc lại: kiến thức đúng, câu lệnh chạy được, dễ hiểu.',
  },
  {
    title: 'Lên trang',
    text: 'Sau khi merge, Ban chủ nhiệm publish bản mới; kênh Discord của CLB báo bài nào thay đổi.',
  },
];

/**
 * How to contribute (INFORMATION-ARCHITECTURE §10, learning-hub#28). Static and public,
 * so the footer link works before signing in; every link goes to the repo that owns that
 * kind of change (lib/contribute.ts).
 */
export default function ContributePage() {
  return (
    <div>
      <header className="motion-fade-up text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Cùng viết <span className="text-brand-600">Learning Hub</span>
        </h1>
        <p className="muted mx-auto mt-3 max-w-2xl">
          Bài học, bài tập và cả trang web này đều do thành viên CLB viết và review. Sửa một lỗi nhỏ
          cũng là đóng góp, và người học sau bạn sẽ được nhờ.
        </p>
      </header>

      <CardGrid id="ways" title="Bạn có thể giúp gì" items={WAYS} />

      <section aria-labelledby="flow" className="mt-14">
        <h2 id="flow" className="text-center text-2xl font-bold">
          Một thay đổi đi từ đâu tới đâu
        </h2>
        <ol className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="surface rounded-xl p-5 shadow-sm">
              <span className="text-sm font-semibold text-brand-600">Bước {index + 1}</span>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="muted mt-1 text-sm">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="muted mx-auto mt-6 max-w-2xl text-center text-sm">
          Chi tiết: quy trình làm việc{' '}
          <a className="font-medium text-brand-600 underline" href={CONTRIBUTE_LINKS.workflow}>
            WORKFLOW
          </a>
          , hướng dẫn{' '}
          <a className="font-medium text-brand-600 underline" href={CONTRIBUTE_LINKS.newTrackGuide}>
            tạo lộ trình mới
          </a>{' '}
          và{' '}
          <a
            className="font-medium text-brand-600 underline"
            href={CONTRIBUTE_LINKS.appContributing}
          >
            đóng góp code
          </a>
          .
        </p>
      </section>
    </div>
  );
}
