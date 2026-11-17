import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** Form-friendly logout: revoke the session in the API, then go home. */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const forwarded: Record<string, string> = { cookie: jar.toString() };
  // The browser's own Origin header: behind the reverse proxy, req.nextUrl.origin is the
  // container's address, which the API's Origin check would reject (SECURITY §5).
  const origin = req.headers.get('origin');
  if (origin) forwarded.origin = origin;
  const clientIp = req.headers.get('x-forwarded-for');
  if (clientIp) forwarded['x-forwarded-for'] = clientIp;

  await fetch(`${API}/api/v1/auth/logout`, { method: 'POST', headers: forwarded }).catch(
    () => undefined,
  );

  jar.delete('sid');
  // A `__Host-` cookie (production) can only be replaced by one with Secure and path=/.
  jar.set('__Host-sid', '', { path: '/', secure: true, httpOnly: true, maxAge: 0 });
  // Same reason: build the home URL from the browser's origin (https), not the container's.
  return NextResponse.redirect(new URL('/', origin ?? req.url), { status: 303 });
}
