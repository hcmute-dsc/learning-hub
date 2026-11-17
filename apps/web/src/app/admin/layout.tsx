import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { adminTabsFor } from '@/components/admin/admin-tabs';
import { getMe } from '@/lib/api';

/**
 * Admin area: tabs for the pages this person may open (INFORMATION-ARCHITECTURE §9).
 * Hiding a tab is only convenience: every page and the API check roles again.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login');
  const tabs = adminTabsFor(me.roles);
  if (!tabs.length) notFound();

  return (
    <div className="space-y-6">
      <AdminTabs tabs={tabs} />
      {children}
    </div>
  );
}
