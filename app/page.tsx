import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Shield, DollarSign, Sparkles } from 'lucide-react';
import { Terminal, TypingAnimation } from '@/components/magicui/terminal';
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
    <main className="relative overflow-hidden">
      {/* Pastel, futuristic background layers */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(186,230,253,0.7),transparent_60%)] blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute -bottom-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(221,214,254,0.6),transparent_60%)] blur-3xl animate-[pulse_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-10 -right-20 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(251,207,232,0.6),transparent_60%)] blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        {/* soft grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      </div>

      {/* Hero */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="md:max-w-2xl lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/60 backdrop-blur border border-white/40 px-3 py-1 text-sm text-gray-700 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Get 50% off Premium AI Models
              </div>
              <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                <span className="block text-gray-900">Access Premium OpenAI Models</span>
                <span className="block bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">At Half The Cost</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
                Same models at 50% off. Fast responses, low rate limiting, transparent billing.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/sign-up">
                  <Button size="lg" className="rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-md">
                    Start Saving Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="rounded-full">
                    See Our Pricing Plans
                  </Button>
                </Link>
              </div>
              <p className="mt-3 text-sm text-gray-500">No commitments. Same models, lower costs.</p>
            </div>

            <div className="relative lg:col-span-5">
              <div className="relative animate-in fade-in slide-in-from-bottom-4">
                <Terminal>
                  <TypingAnimation>$</TypingAnimation>
                  <TypingAnimation>$</TypingAnimation>
                  <TypingAnimation>$</TypingAnimation>
                  <TypingAnimation>$</TypingAnimation>
                  <TypingAnimation>$</TypingAnimation>
                  <TypingAnimation>$</TypingAnimation>
                </Terminal>
              </div>
              <div className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-[conic-gradient(from_90deg_at_50%_50%,rgba(56,189,248,0.25),rgba(167,139,250,0.25),rgba(244,114,182,0.25),rgba(56,189,248,0.25))] blur-2xl opacity-75" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="group rounded-xl border bg-white/70 backdrop-blur px-6 py-8 shadow-sm transition hover:shadow-md hover:translate-y-[-2px]">
              <div className="flex size-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <Zap className="h-6 w-6" />
              </div>
              <h4 className="mt-5 text-lg font-semibold text-gray-900">Lightning fast API</h4>
              <p className="mt-2 text-gray-600">Built on infrastructure Optimized For Low Latency and High Reliability.</p>
            </div>
            <div className="group rounded-xl border bg-white/70 backdrop-blur px-6 py-8 shadow-sm transition hover:shadow-md hover:translate-y-[-2px]">
              <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <DollarSign className="h-6 w-6" />
              </div>
              <h4 className="mt-5 text-lg font-semibold text-gray-900">50% cost savings</h4>
              <p className="mt-2 text-gray-600">Premium models at half the cost—no compromise on quality or performance.</p>
            </div>
            <div className="group rounded-xl border bg-white/70 backdrop-blur px-6 py-8 shadow-sm transition hover:shadow-md hover:translate-y-[-2px]">
              <div className="flex size-12 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Shield className="h-6 w-6" />
              </div>
              <h4 className="mt-5 text-lg font-semibold text-gray-900">Enterprise security</h4>
              <p className="mt-2 text-gray-600">Your keys and data protected with strict isolation, encryption and auditability.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border bg-gradient-to-r from-sky-50 via-indigo-50 to-fuchsia-50 p-10 sm:p-12">
            <div className="grid gap-8 items-center sm:grid-cols-2">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Ready to cut your AI costs?</h2>
                <p className="mt-3 text-gray-600">Join developers saving with Basti. Same models, simpler experience, better pricing.</p>
              </div>
              <div className="flex sm:justify-end">
                <Link href="/sign-up">
                  <Button size="lg" className="rounded-full bg-indigo-600 hover:bg-indigo-700">
                    Start Saving Today
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          Made with ❤️ in Kiambu
        </div>
      </footer>
    </main>
  );
}
