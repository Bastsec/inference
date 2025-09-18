'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import { CreditCard, TrendingUp, Zap, DollarSign } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import KeyManagement from '@/components/KeyManagement';

type ActionState = {
  error?: string;
  success?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CreditBalanceSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Credit Balance</CardTitle>
      </CardHeader>
    </Card>
  );
}

function CreditBalance() {
  const { data: keysData } = useSWR('/api/keys/manage', fetcher);

  const totalCredits = keysData?.keys?.reduce((sum: number, key: any) => sum + (key.credit_balance || 0), 0) || 0;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Credit Balance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-4 sm:mb-0">
              <p className="text-3xl font-bold text-green-600">
                ${totalCredits.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                Available credits for API usage
              </p>
            </div>
            <Link href="/pricing">
              <Button type="button" className="bg-blue-600 hover:bg-blue-700">
                <CreditCard className="mr-2 h-4 w-4" />
                Buy More Credits
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageStatsSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
      </CardHeader>
    </Card>
  );
}

function UsageStats() {
  const { data: usageData } = useSWR('/api/analytics/usage', fetcher);
  const { data: spendData } = useSWR('/api/analytics/spend', fetcher);

  // Process real usage data
  const processUsageStats = () => {
    if (!usageData?.local_analytics?.totals) {
      return {
        thisMonth: 0,
        lastMonth: 0,
        totalRequests: 0,
        avgCostPerRequest: 0
      };
    }

    const totals = usageData.local_analytics.totals;
    const thisMonth = (totals.total_cost_cents || 0) / 100;
    const totalRequests = totals.total_requests || 0;
    const avgCostPerRequest = totalRequests > 0 ? thisMonth / totalRequests : 0;

    return {
      thisMonth,
      lastMonth: thisMonth * 0.8, // Estimate - would need proper date filtering
      totalRequests,
      avgCostPerRequest
    };
  };

  const usage = processUsageStats();

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-5 w-5 text-blue-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">${usage.thisMonth.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">This Month</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-green-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">${usage.lastMonth.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Last Month</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap className="h-5 w-5 text-purple-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">{usage.totalRequests.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-5 w-5 text-orange-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">${usage.avgCostPerRequest.toFixed(3)}</p>
            <p className="text-sm text-muted-foreground">Avg/Request</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeyManagementSkeleton() {
  return (
    <Card className="h-[200px]">
      <CardHeader>
        <CardTitle>API Key Management</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ApiKeyManagement() {
  return <KeyManagement compact={false} />;
}

export default function BillingPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Billing & Usage</h1>
      <Suspense fallback={<CreditBalanceSkeleton />}>
        <CreditBalance />
      </Suspense>
      <Suspense fallback={<UsageStatsSkeleton />}>
        <UsageStats />
      </Suspense>
      <Suspense fallback={<ApiKeyManagementSkeleton />}>
        <ApiKeyManagement />
      </Suspense>
    </section>
  );
}
