import type { LeaderboardRow } from '@hub/shared';
import { initials, MEDAL_TONE, medalFor, podiumOrder } from './board';
import type { ShareCardData } from './share-card';

/**
 * The share image (learning-hub#88), drawn by next/og (Satori): inline styles only, and
 * every box with more than one child is a flex box. Dark card in the club's orange, so
 * it reads well on a fanpage in both light and dark feeds.
 */

const C = {
  bg: '#0b1220',
  panel: '#131c2e',
  line: '#24324a',
  text: '#f8fafc',
  muted: '#94a3b8',
  brand: '#f26b1d',
};

export interface ShareCardAssets {
  /** data: URI of the club logo for a dark background */
  logo: string;
  /** user id → data: URI of their avatar (missing → initials) */
  avatars: Map<string, string>;
}

export function ShareCard({ data, assets }: { data: ShareCardData; assets: ShareCardAssets }) {
  const wide = data.size === 'wide';
  const pad = wide ? 48 : 64;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: pad,
        background: `radial-gradient(circle at 50% 0%, #2a1a12 0%, ${C.bg} 55%)`,
        color: C.text,
        fontFamily: 'Be Vietnam Pro',
      }}
    >
      <Header data={data} logo={assets.logo} wide={wide} />
      {data.empty ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.muted,
            fontSize: 36,
          }}
        >
          Chưa có ai trên bảng.
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: wide ? 'row' : 'column',
            gap: wide ? 40 : 28,
            marginTop: wide ? 24 : 28,
          }}
        >
          <Podium rows={data.podium} avatars={assets.avatars} wide={wide} />
          {data.rest.length > 0 && <List rows={data.rest} avatars={assets.avatars} wide={wide} />}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          marginTop: 20,
          paddingTop: 16,
          borderTop: `2px solid ${C.line}`,
          color: C.muted,
          fontSize: wide ? 18 : 20,
        }}
      >
        {data.footer}
      </div>
    </div>
  );
}

function Header({ data, logo, wide }: { data: ShareCardData; logo: string; wide: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', color: C.brand, fontSize: wide ? 22 : 26, fontWeight: 800 }}>
          🏆 {data.title.toUpperCase()}
        </div>
        <div style={{ display: 'flex', fontSize: wide ? 40 : 44, fontWeight: 800, marginTop: 6 }}>
          {data.period}
        </div>
        {data.track && (
          <div style={{ display: 'flex', color: C.muted, fontSize: wide ? 22 : 26, marginTop: 6 }}>
            Lộ trình: {data.track}
          </div>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> */}
      <img
        src={logo}
        alt=""
        height={wide ? 56 : 56}
        style={{ height: wide ? 56 : 56, marginTop: 4 }}
      />
    </div>
  );
}

function Avatar({
  row,
  avatars,
  size,
  ring,
}: {
  row: LeaderboardRow;
  avatars: Map<string, string>;
  size: number;
  ring?: string;
}) {
  const src = avatars.get(row.user.id);
  const border = ring ? `${Math.round(size / 18)}px solid ${ring}` : `2px solid ${C.line}`;
  if (src) {
    // The ring is on a wrapper: Satori fails on a border drawn on the <img> itself.
    const inner = size - 2 * Math.round(size / 18);
    return (
      <div
        style={{
          display: 'flex',
          width: size,
          height: size,
          borderRadius: size,
          border,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> */}
        <img
          src={src}
          alt=""
          width={inner}
          height={inner}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        border,
        background: C.panel,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size / 2.8,
        fontWeight: 800,
        color: C.muted,
      }}
    >
      {initials(row.user.displayName)}
    </div>
  );
}

function Podium({
  rows,
  avatars,
  wide,
}: {
  rows: LeaderboardRow[];
  avatars: Map<string, string>;
  wide: boolean;
}) {
  // Step heights: 1st tallest. Wide cards have less height to spend.
  const stepHeight = (rank: number) =>
    (wide ? { 1: 150, 2: 110, 3: 84 } : { 1: 150, 2: 110, 3: 80 })[rank as 1 | 2 | 3] ?? 84;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: wide ? 16 : 24,
        ...(wide ? { flex: 1.3 } : {}), // Satori breaks on `flex: undefined`
      }}
    >
      {podiumOrder(rows).map((row) => {
        const medal = medalFor(row.rank) ?? 'bronze';
        const tone = MEDAL_TONE[medal];
        const first = row.rank === 1;
        const avatar = wide ? (first ? 104 : 84) : first ? 124 : 100;
        return (
          <div
            key={row.user.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: wide ? 200 : 290,
            }}
          >
            <Avatar row={row} avatars={avatars} size={avatar} ring={tone.to} />
            <div
              style={{
                display: 'flex',
                marginTop: 12,
                fontSize: wide ? 22 : first ? 30 : 26,
                fontWeight: 800,
                maxWidth: wide ? 200 : 290,
                textAlign: 'center',
                justifyContent: 'center',
              }}
            >
              {clip(row.user.displayName, wide ? 18 : 22)}
            </div>
            <div
              style={{ display: 'flex', color: C.muted, fontSize: wide ? 18 : 22, marginTop: 4 }}
            >
              {row.score} điểm · {row.completed} bài
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                marginTop: 12,
                width: '100%',
                height: stepHeight(row.rank),
                borderRadius: '18px 18px 0 0',
                background: `linear-gradient(180deg, ${tone.from}, ${tone.to})`,
                paddingTop: 12,
                color: '#1f1305',
                fontSize: wide ? 44 : 52,
                fontWeight: 800,
              }}
            >
              {row.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Ranks after the podium: one column on the wide card, two columns on the square one. */
function List({
  rows,
  avatars,
  wide,
}: {
  rows: LeaderboardRow[];
  avatars: Map<string, string>;
  wide: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: wide ? 'column' : 'row',
        flexWrap: wide ? 'nowrap' : 'wrap',
        gap: wide ? 10 : 12,
        flex: 1,
        justifyContent: wide ? 'center' : 'space-between',
        alignContent: 'flex-start',
      }}
    >
      {rows.map((row) => (
        <div
          key={row.user.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            width: wide ? '100%' : 468,
            padding: wide ? '8px 16px' : '10px 16px',
            borderRadius: 14,
            background: C.panel,
            border: `1px solid ${C.line}`,
            fontSize: wide ? 22 : 22,
          }}
        >
          <div style={{ display: 'flex', width: 30, color: C.muted, fontWeight: 800 }}>
            {row.rank}
          </div>
          <Avatar row={row} avatars={avatars} size={40} />
          <div style={{ display: 'flex', flex: 1, fontWeight: 800 }}>
            {clip(row.user.displayName, wide ? 22 : 18)}
          </div>
          <div style={{ display: 'flex', color: C.brand, fontWeight: 800 }}>{row.score} điểm</div>
        </div>
      ))}
    </div>
  );
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
