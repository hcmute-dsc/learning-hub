import { notFound, redirect } from 'next/navigation';
import { adminHomeFor } from '@/components/admin/admin-tabs';
import { getMe } from '@/lib/api';

/** /admin has no page of its own (yet): go to the first tab this person may open. */
export default async function AdminIndexPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const home = adminHomeFor(me.roles);
  if (!home) notFound();
  redirect(home);
}
