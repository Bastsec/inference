import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Stripe has been removed from this project.' },
    { status: 410 }
  );
}
