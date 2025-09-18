import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Shield, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default async function HomePage() {
  // Check if user is authenticated
  const user = await getUser();
  
  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  // Show landing page for unauthenticated users
  return (
    <main>
      
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
                Access Premium AI Models
                <span className="block text-blue-600">At 50% Off</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                Get access to OpenAI's latest models including GPT-4o, GPT-4 Turbo, 
                and more at half the cost. No compromises on quality, just better pricing.
              </p>
              <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                <div className="flex gap-4">
                  <Link href="/sign-up">
                    <Button
                      size="lg"
                      className="text-lg rounded-full bg-blue-600 hover:bg-blue-700"
                    >
                      Start Saving Now
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/sign-in">
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-lg rounded-full"
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Why Choose Basti?</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    50% off all premium models
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                    Same speed & quality as OpenAI
                  </li>
                  <li className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Secure & reliable API access
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <div>
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                <Zap className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-gray-900">
                  Lightning Fast API
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  Get the same speed and reliability as OpenAI's direct API
                  with our optimized infrastructure.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-gray-900">
                  50% Cost Savings
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  Access premium AI models at half the cost without
                  compromising on quality or performance.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-gray-900">
                  Enterprise Security
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  Your API keys and data are protected with enterprise-grade
                  security and encryption.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Ready to cut your AI costs in half?
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-500">
                Join thousands of developers and businesses who are saving 50% on their
                AI model costs with Basti. Get started in minutes with the same API you know and love.
              </p>
            </div>
            <div className="mt-8 lg:mt-0 flex justify-center lg:justify-end">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="text-lg rounded-full bg-blue-600 hover:bg-blue-700"
                >
                  Start Saving Today
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
