import { NextResponse } from 'next/server';
import {
  fixtureAllowlistSnapshot,
  verifyAllowlistMembership,
  verifySnapshotIntegrity,
} from '@/lib/offline';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get('account');
  const snapshot = fixtureAllowlistSnapshot();
  return NextResponse.json({
    snapshot,
    integrity: verifySnapshotIntegrity(snapshot),
    membership: account
      ? { account, member: verifyAllowlistMembership(snapshot, account) }
      : undefined,
  });
}
