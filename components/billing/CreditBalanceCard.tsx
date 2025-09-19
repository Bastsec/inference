'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

type KeysResponse = {
  keys?: { credit_balance?: number }[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface CreditBalanceCardProps {
  className?: string;
  ctaHref?: string;
  ctaLabel?: string;
}

export default function CreditBalanceCard({
  className,
  ctaHref = '/pricing',
  ctaLabel = 'Buy More Credits',
}: CreditBalanceCardProps) {
  const { data, isLoading, mutate } = useSWR<KeysResponse>('/api/keys/manage', fetcher);

  // Debug: log whenever data changes
  if (typeof window !== 'undefined') {
    try {
      console.debug('[CreditBalanceCard] data:', data);
    } catch {}
  }

  const totalCredits = (data?.keys || []).reduce(
    (sum, k) => sum + (k.credit_balance || 0),
    0,
  );

  return (
    <Card className={cn('mb-8', className)}>
      <CardHeader>
        <CardTitle>Credit Balance</CardTitle>
        <CardDescription>Available credits for API usage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p
              className={cn(
                'text-3xl font-bold',
                totalCredits <= 0 ? 'text-red-600' : 'text-green-600',
              )}
            >
              {isLoading ? '—' : `$${totalCredits.toFixed(2)}`}
            </p>
          </div>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href={ctaHref}>
              <CreditCard className="mr-2 h-4 w-4" />
              {ctaLabel}
            </Link>
          </Button>
        </div>
        {/* Hidden refresh button for debugging */}
        <button onClick={() => mutate()} style={{ display: 'none' }} aria-hidden>
          refresh
        </button>
      </CardContent>
    </Card>
  );
}
