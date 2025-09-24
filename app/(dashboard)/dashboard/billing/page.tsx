// Server Component: Billing & Keys page

import { getUser } from '@/lib/db/queries';
import nextDynamic from 'next/dynamic';

// Import client components dynamically to avoid RSC issues
const CreditBalanceCard = nextDynamic(() => import('@/components/billing/CreditBalanceCard'), { ssr: false });
const KeyManagement = nextDynamic(() => import('@/components/KeyManagement'), { ssr: false });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const user = await getUser();

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">API Keys & Billing</h1>
        <p className="mt-2 text-gray-600">
          {user?.name ? `${user.name}, ` : ''}view your remaining credits and manage API keys.
        </p>
      </div>

      {/* Remaining credits */}
      <CreditBalanceCard />

      {/* Key management */}
      <KeyManagement showHeader compact={false} />
    </main>
  );
}
