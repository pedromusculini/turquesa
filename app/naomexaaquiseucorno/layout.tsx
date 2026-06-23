import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { isInternalAdminEmail } from '@/lib/internalAdmin';
import InternalAdminNav from '@/components/InternalAdminNav';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!isInternalAdminEmail(session?.user?.email)) {
    notFound();
  }

  return (
    <div className="internal-ops-theme min-h-screen bg-zinc-950 text-zinc-100 selection:bg-red-900/50">
      <InternalAdminNav />
      {children}
    </div>
  );
}
