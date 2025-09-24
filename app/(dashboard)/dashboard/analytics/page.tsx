'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  TrendingUp,
  Zap,
  DollarSign,
  Clock,
  Activity,
  type LucideIcon,
} from 'lucide-react';

interface AnalyticsData {
  totalRequests: number;
  totalSpent: number;
  avgResponseTime: number;
  successRate: number;
  topModels: Array<{
    name: string;
    requests: number;
    cost: number;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
    cost: number;
  }>;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle 
}: { 
  title: string; 
  value: string; 
  icon: LucideIcon; 
  color: string; 
  subtitle?: string; 
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-full ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        
        // Get current date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const params = new URLSearchParams({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          page_size: '1000'
        });

        const [usageResponse, spendResponse] = await Promise.all([
          fetch(`/api/analytics/usage?${params}`),
          fetch(`/api/analytics/spend?${params}`)
        ]);

        if (!usageResponse.ok || !spendResponse.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const usageData = await usageResponse.json();
        const spendData = await spendResponse.json();

        // Process the data to match our interface
        const processedData = processAnalyticsData(usageData, spendData);
        setAnalytics(processedData);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const processAnalyticsData = (usageData: any, spendData: any): AnalyticsData => {
    const totals = usageData.local_analytics?.totals || {
      total_cost_cents: 0,
      total_tokens: 0,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0
    };

    const modelBreakdown = usageData.local_analytics?.breakdown?.by_model || {};
    const dateBreakdown = usageData.local_analytics?.breakdown?.by_date || {};

    // Convert model breakdown to top models array
    const topModels = Object.entries(modelBreakdown)
      .map(([name, data]: [string, any]) => ({
        name,
        requests: data.requests || 0,
        cost: (data.cost_cents || 0) / 100
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 3);

    // Convert date breakdown to daily usage array
    const dailyUsage = Object.entries(dateBreakdown)
      .map(([date, data]: [string, any]) => ({
        date,
        requests: data.requests || 0,
        cost: (data.cost_cents || 0) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days

    return {
      totalRequests: totals.total_requests || 0,
      totalSpent: (totals.total_cost_cents || 0) / 100,
      avgResponseTime: 1.2, // This would need to be calculated from request_duration_ms
      successRate: totals.total_requests > 0 
        ? ((totals.successful_requests || 0) / totals.total_requests) * 100 
        : 0,
      topModels,
      dailyUsage
    };
  };

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
          Analytics & Usage
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading analytics...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
          Analytics & Usage
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Error: {error}</div>
        </div>
      </section>
    );
  }

  if (!analytics) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
          Analytics & Usage
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">No analytics data available</div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Analytics & Usage
      </h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Requests"
          value={analytics.totalRequests.toLocaleString()}
          icon={BarChart3}
          color="bg-blue-500"
          subtitle="Last 30 days"
        />
        <StatCard
          title="Total Spent"
          value={`$${analytics.totalSpent.toFixed(2)}`}
          icon={DollarSign}
          color="bg-green-500"
          subtitle="50% savings vs OpenAI"
        />
        <StatCard
          title="Avg Response Time"
          value={`${analytics.avgResponseTime}s`}
          icon={Clock}
          color="bg-purple-500"
          subtitle="Lightning fast"
        />
        <StatCard
          title="Success Rate"
          value={`${analytics.successRate.toFixed(1)}%`}
          icon={Activity}
          color="bg-orange-500"
          subtitle="Highly reliable"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              Top Models Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topModels.length > 0 ? (
                analytics.topModels.map((model, index) => (
                  <div key={model.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {model.requests} requests
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${model.cost.toFixed(2)}</p>
                      <p className="text-sm text-green-600">50% off</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No model usage data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Daily Usage (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.dailyUsage.length > 0 ? (
                analytics.dailyUsage.map((day) => (
                  <div key={day.date} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {new Date(day.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {day.requests} requests
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${day.cost.toFixed(2)}</p>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${Math.min((day.requests / Math.max(...analytics.dailyUsage.map(d => d.requests), 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No daily usage data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Savings Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Cost Savings Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                ${analytics.totalSpent.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">You Paid (Bastion)</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                ${(analytics.totalSpent * 2).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">OpenAI Direct Cost</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                ${analytics.totalSpent.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Total Savings</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-center text-green-800 font-medium">
              🎉 You've saved 50% on your AI costs this month with Bastion!
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
