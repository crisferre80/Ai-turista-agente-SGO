import { NextResponse } from 'next/server';

// Google Directions API proxy removed — endpoint disabled.
export async function GET() {
  return NextResponse.json({ error: 'google directions proxy removed' }, { status: 410 });
}
