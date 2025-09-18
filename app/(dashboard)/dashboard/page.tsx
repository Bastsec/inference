'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import Link from 'next/link';
import useSWR from 'swr';
import { Suspense } from 'react';
import { CreditCard, TrendingUp, Zap, DollarSign } from 'lucide-react';

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
  // Mock data - in a real app, this would come from your usage tracking API
  const mockUsage = {
    thisMonth: 15.50,
    lastMonth: 22.30,
    totalRequests: 1250,
    avgCostPerRequest: 0.012
  };

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
            <p className="text-2xl font-bold">${mockUsage.thisMonth}</p>
            <p className="text-sm text-muted-foreground">This Month</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-green-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">${mockUsage.lastMonth}</p>
            <p className="text-sm text-muted-foreground">Last Month</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap className="h-5 w-5 text-purple-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">{mockUsage.totalRequests.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-5 w-5 text-orange-600 mr-1" />
            </div>
            <p className="text-2xl font-bold">${mockUsage.avgCostPerRequest}</p>
            <p className="text-sm text-muted-foreground">Avg/Request</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PricingTiersSkeleton() {
  return (
    <Card className="h-[200px]">
      <CardHeader>
        <CardTitle>Available Credit Packages</CardTitle>
      </CardHeader>
    </Card>
  );
}

function PricingTiers() {
  const tiers = [
    { name: 'Starter', price: 10, credits: 20, popular: false },
    { name: 'Pro', price: 50, credits: 100, popular: true },
    { name: 'Enterprise', price: 200, credits: 400, popular: false }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Credit Packages</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <div 
              key={tier.name} 
              className={`border rounded-lg p-4 text-center ${tier.popular ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              {tier.popular && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full mb-2 inline-block">
                  Most Popular
                </span>
              )}
              <h3 className="font-semibold text-lg">{tier.name}</h3>
              <p className="text-2xl font-bold text-green-600">${tier.price}</p>
              <p className="text-sm text-muted-foreground mb-4">
                ${tier.credits} worth of credits
              </p>
              <Link href="/pricing">
                <Button 
                  className={`w-full ${tier.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  variant={tier.popular ? 'default' : 'outline'}
                >
                  Buy Now
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
      <Suspense fallback={<PricingTiersSkeleton />}>
        <PricingTiers />
      </Suspense>
    </section>
  );
}
