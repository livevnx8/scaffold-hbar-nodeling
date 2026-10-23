import { NextResponse } from 'next/server';
import { verifyPayload } from '@/lib/offline';
import type { AuthenticityReceipt, DropReceiptsSidecar } from '@nodeling/core';

export async function POST(req: Request) {
  let body: {
    receipt?: AuthenticityReceipt | DropReceiptsSidecar;
    receiptsPackage?: DropReceiptsSidecar;
    hrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const result = verifyPayload(body);
  const okStatus = result.ok || result.kind === 'hrl' || result.kind === 'receipts_package';
  return NextResponse.json(result, { status: okStatus ? 200 : 400 });
}
