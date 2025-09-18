import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CircleIcon } from 'lucide-react';

export default function AuthCodeError() {
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CircleIcon className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Authentication Error
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          There was an error signing you in. Please try again.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/sign-in">
                Try Again
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">
                Create New Account
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
