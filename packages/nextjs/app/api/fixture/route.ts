import { NextResponse } from 'next/server';
import { getFixtureBundle } from '@/lib/offline';

export async function GET() {
  return NextResponse.json(getFixtureBundle());
}
