import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default async function PricingPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <section>
        <h1 className="text-3xl font-semibold mb-2">Buy Credits at 50% Off</h1>
        <p className="text-sm text-gray-600">Purchase credits to access premium AI models at half the cost. Credits are consumed when you make API calls to OpenAI models.</p>
      </section>

      <div className="grid md:grid-cols-3 gap-8">
        <TopUpCard
          name="Starter"
          amountUsd={10}
          plan="basic"
          features={[
            '$20 worth of API credits',
            '50% savings vs OpenAI',
            'All premium models',
          ]}
        />
        <TopUpCard
          name="Pro"
          amountUsd={50}
          plan="pro"
          features={[
            '$100 worth of API credits',
            '50% savings vs OpenAI',
            'Priority support',
          ]}
        />
        <TopUpCard
          name="Enterprise"
          amountUsd={200}
          plan="advanced"
          features={[
            '$400 worth of API credits',
            '50% savings vs OpenAI',
            'Dedicated support',
          ]}
        />
      </div>

      {/* Custom top-up removed; only fixed plan amounts are allowed */}
      
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
