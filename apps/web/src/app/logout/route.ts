import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** Form-friendly logout: revoke the session in the API, then go home. */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  await fetch(`${API}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { cookie: jar.toString(), origin: req.nextUrl.origin },
  }).catch(() => undefined);
  jar.delete('sid');
  jar.delete('__Host-sid');
  return NextResponse.redirect(new URL('/', req.url), { status: 303 });
}
