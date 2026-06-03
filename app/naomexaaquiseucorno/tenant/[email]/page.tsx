import { InternalTenantDetailClient } from '@/components/InternalOpsClient';

type PageProps = { params: Promise<{ email: string }> };

export default async function InternalTenantPage({ params }: PageProps) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  return <InternalTenantDetailClient email={decoded} />;
}
