import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import type { Leaderboard, LeaderboardRow } from '@hub/shared';
import {
  boardSearch,
  imageFileName,
  parseBoardQuery,
  parseShareSize,
  SHARE_SIZES,
} from '@/components/leaderboard/board';
import { ShareCard } from '@/components/leaderboard/ShareCard';
import { avatarSmall, shareCardData } from '@/components/leaderboard/share-card';
import { api, ApiError } from '@/lib/api';

/**
 * GET /leaderboard/image?…filters…&size=square|wide → PNG of the board for the fanpage or
 * website (learning-hub#88). Drawn on the server with next/og, from the same API call as
 * the page, so it needs the member's session and only ever shows opted-in members.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_DIR = join(process.cwd(), 'public');
/** Be Vietnam Pro (OFL, public/fonts): whole fonts, so every Vietnamese letter has its weight. */
const FONT_FILES = [
  { file: 'BeVietnamPro-Regular.ttf', weight: 400 },
  { file: 'BeVietnamPro-ExtraBold.ttf', weight: 800 },
] as const;

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const query = parseBoardQuery(params);
  const size = parseShareSize(params.size);

  let board: Leaderboard;
  try {
    const search = boardSearch(query);
    ({ data: board } = await api<{ data: Leaderboard }>(
      `/leaderboard${search ? `?${search}` : ''}`,
    ));
  } catch (err) {
    if (err instanceof ApiError) {
      return new Response(err.problem.title, { status: err.problem.status });
    }
    throw err; // redirects to /login or /pending, or a real error
  }

  const host = req.headers.get('x-forwarded-host') ?? req.nextUrl.host;
  const data = shareCardData(board, size, host);
  const [fonts, logo, avatars] = await Promise.all([
    Promise.all(
      FONT_FILES.map(async (f) => ({
        name: 'Be Vietnam Pro',
        data: await readFile(join(PUBLIC_DIR, 'fonts', f.file)),
        weight: f.weight,
        style: 'normal' as const,
      })),
    ),
    readFile(join(PUBLIC_DIR, 'brand', 'hcmute-dsc-mark-dark.png')).then(
      (b) => `data:image/png;base64,${b.toString('base64')}`,
    ),
    loadAvatars([...data.podium, ...data.rest]),
  ]);

  const { width, height } = SHARE_SIZES[size];
  return new ImageResponse(<ShareCard data={data} assets={{ logo, avatars }} />, {
    width,
    height,
    fonts,
    headers: {
      // The board depends on who may see it (signed-in members): never a shared cache.
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${imageFileName(board.range.id, board.track?.slug ?? null, size)}"`,
    },
  });
}

/**
 * Avatars as data: URIs, fetched here with a short timeout, so a slow or missing avatar
 * becomes initials instead of breaking the whole image.
 */
async function loadAvatars(rows: LeaderboardRow[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    rows.map(async (row): Promise<[string, string] | null> => {
      // Only GitHub avatars: the server never fetches an arbitrary URL from the database.
      if (!row.user.avatarUrl?.startsWith('https://avatars.githubusercontent.com/')) return null;
      try {
        const res = await fetch(avatarSmall(row.user.avatarUrl, 160), {
          signal: AbortSignal.timeout(3000),
        });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !/^image\/(png|jpeg|gif|webp)/.test(type)) return null;
        const bytes = Buffer.from(await res.arrayBuffer());
        return [row.user.id, `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`];
      } catch {
        return null;
      }
    }),
  );
  return new Map(entries.filter((e): e is [string, string] => e !== null));
}
