'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function PricingTemplate({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  const status = params.get('status');
  const reference = params.get('reference') || params.get('trxref');

  const storageKey = useMemo(() => (reference ? `pricing_toast_${reference}` : null), [reference]);

  useEffect(() => {
    try {
      if (status === 'success' && reference) {
        const alreadyShown = storageKey ? sessionStorage.getItem(storageKey) : null;
        if (!alreadyShown) {
          setRef(reference);
          setMessage('Payment verified. Credits will reflect shortly.');
          setVisible(true);
          if (storageKey) sessionStorage.setItem(storageKey, '1');
        }
      }
    } catch (e) {
      // non-fatal
      console.warn('Pricing toast setup failed:', e);
    }
  }, [status, reference, storageKey]);

  const onDismiss = () => setVisible(false);
  const goDashboard = () => router.push('/dashboard');

  return (
    <>
      {children}
      {visible && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 shadow-lg">
          <div className="p-4">
            <div className="font-medium">Payment successful</div>
            <div className="mt-1 text-sm opacity-90">{message}</div>
            {ref && (
              <div className="mt-1 text-[11px] opacity-60">Ref: {ref}</div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={goDashboard}
                className="inline-flex items-center rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
              >
                View dashboard
              </button>
              <button
                onClick={onDismiss}
                className="inline-flex items-center rounded border px-3 py-1 text-sm text-emerald-900 hover:bg-emerald-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

