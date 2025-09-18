import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { AuthTest } from '@/components/auth-test';

export default async function PricingPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <section>
        <h1 className="text-3xl font-semibold mb-2">Top up credits</h1>
        <p className="text-sm text-gray-600">Use Paystack to add credits to your account (USD). Credits are consumed when you call the LLM proxy.</p>
      </section>

      <div className="grid md:grid-cols-3 gap-8">
        <TopUpCard
          name="Basic"
          amountUsd={5}
          plan="basic"
          features={[
            'Entry plan',
            'Immediate access',
            'Email support',
          ]}
        />
        <TopUpCard
          name="Pro"
          amountUsd={10}
          plan="pro"
          features={[
            'For active usage',
            'Priority processing',
            'Email support',
          ]}
        />
        <TopUpCard
          name="Advanced"
          amountUsd={20}
          plan="advanced"
          features={[
            'Larger top-up',
            'Priority processing',
            'Email support',
          ]}
        />
      </div>

      {/* Custom top-up removed; only fixed plan amounts are allowed */}
      
      {/* Test component for OAuth flow from pricing page */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Authentication Test</h2>
        <p className="text-sm text-gray-600 mb-4">
          Test OAuth sign-in from pricing page - should redirect back to pricing after authentication.
        </p>
        <AuthTest source="pricing" next="/pricing" />
      </section>
    </main>
  );
}

function TopUpCard({
  name,
  amountUsd,
  features,
  plan,
}: {
  name: string;
  amountUsd: number;
  features: string[];
  plan: 'basic' | 'pro' | 'advanced';
}) {
  return (
    <div className="pt-6">
      <h2 className="text-2xl font-medium text-gray-900 mb-2">{name}</h2>
      <p className="text-4xl font-medium text-gray-900 mb-6">${amountUsd.toLocaleString('en-US')}</p>
      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="w-full rounded-full">
        <Link href={`/api/checkout/start?plan=${plan}`}>
          Get Started
        </Link>
      </Button>
    </div>
  );
}

// Custom top-up form removed
