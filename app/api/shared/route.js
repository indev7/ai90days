import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSharedOKRTsForUser } from '@/lib/db';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sharedOKRTs = await getSharedOKRTsForUser(session.sub);
    return NextResponse.json({ okrts: sharedOKRTs });
  } catch (error) {
    console.error('Error fetching shared OKRTs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}