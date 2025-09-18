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

// Mock data - in a real app, this would come from your analytics API
const mockAnalytics = {
  totalRequests: 1250,
  totalSpent: 37.80,
  avgResponseTime: 1.2,
  successRate: 99.2,
  topModels: [
    { name: 'GPT-4o', requests: 650, cost: 19.50 },
    { name: 'GPT-4o-mini', requests: 400, cost: 12.00 },
    { name: 'GPT-4 Turbo', requests: 200, cost: 6.30 }
  ],
  dailyUsage: [
    { date: '2024-01-15', requests: 45, cost: 1.35 },
    { date: '2024-01-16', requests: 62, cost: 1.86 },
    { date: '2024-01-17', requests: 38, cost: 1.14 },
    { date: '2024-01-18', requests: 71, cost: 2.13 },
    { date: '2024-01-19', requests: 89, cost: 2.67 },
    { date: '2024-01-20', requests: 56, cost: 1.68 },
    { date: '2024-01-21', requests: 94, cost: 2.82 }
  ]
};

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

export default async function AnalyticsPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Analytics & Usage
      </h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Requests"
          value={mockAnalytics.totalRequests.toLocaleString()}
          icon={BarChart3}
          color="bg-blue-500"
          subtitle="This month"
        />
        <StatCard
          title="Total Spent"
          value={`$${mockAnalytics.totalSpent.toFixed(2)}`}
          icon={DollarSign}
          color="bg-green-500"
          subtitle="50% savings vs OpenAI"
        />
        <StatCard
          title="Avg Response Time"
          value={`${mockAnalytics.avgResponseTime}s`}
          icon={Clock}
          color="bg-purple-500"
          subtitle="Lightning fast"
        />
        <StatCard
          title="Success Rate"
          value={`${mockAnalytics.successRate}%`}
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
              {mockAnalytics.topModels.map((model, index) => (
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
              ))}
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
              {mockAnalytics.dailyUsage.map((day) => (
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
                        style={{ width: `${(day.requests / 100) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
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
                ${(mockAnalytics.totalSpent).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">You Paid (Basti)</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                ${(mockAnalytics.totalSpent * 2).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">OpenAI Direct Cost</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                ${mockAnalytics.totalSpent.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Total Savings</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-center text-green-800 font-medium">
              🎉 You've saved 50% on your AI costs this month with Basti!
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}