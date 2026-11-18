import { NextResponse } from 'next/server';
import { clearTeamCookie } from '@/lib/server/auth';

export async function POST() {
  return clearTeamCookie(NextResponse.json({ ok: true }));
}
