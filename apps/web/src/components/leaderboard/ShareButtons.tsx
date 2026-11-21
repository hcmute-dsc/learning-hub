'use client';

import { useState } from 'react';
import { imageFileName, imageHref, SHARE_SIZES, type BoardQuery, type ShareSize } from './board';

/**
 * "Lưu ảnh" (learning-hub#88): the board as a PNG drawn on the server, in the square
 * fanpage size or the wide website size. A preview opens first, so the member sees what
 * they are about to post; the download keeps a clear file name.
 */
export function ShareButtons({
  query,
  rangeId,
  disabled,
}: {
  query: BoardQuery;
  rangeId: string;
  disabled: boolean;
}) {
  const [size, setSize] = useState<ShareSize | null>(null);

  if (disabled) {
    return <p className="muted text-sm">Chưa có ai trên bảng này, nên chưa có ảnh để lưu.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Lưu ảnh để đăng fanpage, website:</span>
        {(Object.keys(SHARE_SIZES) as ShareSize[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(size === s ? null : s)}
            aria-pressed={size === s}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500 aria-pressed:border-brand-500 aria-pressed:bg-brand-50"
          >
            {SHARE_SIZES[s].label}
          </button>
        ))}
      </div>
      {size && (
        <figure className="motion-fade-up space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-drawn PNG, shown as is */}
          <img
            src={imageHref(query, size)}
            alt="Ảnh bảng xếp hạng để chia sẻ"
            width={SHARE_SIZES[size].width}
            height={SHARE_SIZES[size].height}
            className="h-auto w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--code-bg)]"
          />
          <a
            href={imageHref(query, size)}
            download={imageFileName(rangeId, query.track ?? null, size)}
            className="press inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            ⬇ Tải ảnh PNG
          </a>
          <figcaption className="muted text-xs">
            Ảnh chỉ có thành viên đã tự bật bảng xếp hạng, không có hạng của riêng bạn.
          </figcaption>
        </figure>
      )}
    </div>
  );
}
