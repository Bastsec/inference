import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Basti - Premium AI Models at 50% Off',
  description: 'Access OpenAI GPT-4o, GPT-4 Turbo, and more at half the cost. Same quality, better pricing.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <head />
      <body className="min-h-[100dvh] bg-gray-50">
        {children}
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';
