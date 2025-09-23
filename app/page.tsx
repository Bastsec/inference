import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Shield, DollarSign, Sparkles } from 'lucide-react';
import { Terminal, TypingAnimation } from '@/components/magicui/terminal';
import Link from 'next/link';
export const dynamic = 'force-static';

export default function HomePage() {

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
            {/* Card 1 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400/25 via-indigo-400/20 to-fuchsia-400/25 opacity-0 blur-xl transition duration-700 group-hover:opacity-100" />
              <div className="relative rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-700 ring-1 ring-inset ring-white/60">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-semibold text-gray-900">Lightning-fast API</h4>
                </div>
                <p className="mt-4 text-gray-600">Infrastructure tuned for low latency and high reliability.</p>
                <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <p className="mt-4 text-sm text-gray-500">99.9% uptime • Multi-region edge</p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/25 via-teal-400/20 to-sky-400/25 opacity-0 blur-xl transition duration-700 group-hover:opacity-100" />
              <div className="relative rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-inset ring-white/60">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-semibold text-gray-900">50% cost savings</h4>
                </div>
                <p className="mt-4 text-gray-600">Premium models at half the cost—no compromise on quality.</p>
                <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <p className="mt-4 text-sm text-gray-500">Transparent usage • Simple billing</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/25 via-indigo-400/20 to-fuchsia-400/25 opacity-0 blur-xl transition duration-700 group-hover:opacity-100" />
              <div className="relative rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700 ring-1 ring-inset ring-white/60">
                    <Shield className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-semibold text-gray-900">Enterprise security</h4>
                </div>
                <p className="mt-4 text-gray-600">Key isolation, encryption, and auditable access controls by default.</p>
                <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <p className="mt-4 text-sm text-gray-500">SOC-ready practices • SSO support</p>
              </div>
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
