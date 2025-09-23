// Server Component: fetches user on the server

import { Card } from '@/components/ui/card';
import { ArrowRight, BarChart3, Key, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { getUser } from '@/lib/db/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{user?.name ? `, ${user.name}` : ''}!
        </h1>
        <p className="mt-2 text-gray-600">
          Manage your API keys, view usage analytics, and access premium models at 50% off.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link href="/dashboard/analytics">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200">
            <div className="flex items-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Analytics</h3>
                <p className="text-sm text-gray-500">View usage metrics and insights</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>

        <Link href="/dashboard">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-200">
            <div className="flex items-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                <Key className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">API Keys & Billing</h3>
                <p className="text-sm text-gray-500">Manage keys and view billing</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>

        <Link href="/pricing">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200">
            <div className="flex items-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Credits</h3>
                <p className="text-sm text-gray-500">Buy credits at 50% off</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Start</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span>Account verified ✓</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
              <span>Create your first API key</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
              <span>Start using OpenAI models at 50% off</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Model Access</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>GPT-4o</span>
              <span className="text-green-600 font-medium">50% off</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>GPT-4o-mini</span>
              <span className="text-green-600 font-medium">50% off</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>GPT-4 Turbo</span>
              <span className="text-green-600 font-medium">50% off</span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

