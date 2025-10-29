import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import {
  getRewardSummaryForOKRT,
  getUserById,
  getUserByEmail
} from '@/lib/pgdb';

const nextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
};

async function getCurrentUser() {
  // Try custom session first (for email/password login)
  let session = await getSession();
  let user = null;
  
  if (session) {
    // Custom JWT session
    user = await getUserById(session.sub);
  } else {
    // Try NextAuth session (for Microsoft login)
    const nextAuthSession = await getServerSession(nextAuthOptions);
    
    if (nextAuthSession?.user?.email) {
      user = await getUserByEmail(nextAuthSession.user.email);
    }
  }
  
  return user;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const okrtId = searchParams.get('okrtId');

    if (!okrtId) {
      return NextResponse.json({ error: 'Missing okrtId parameter' }, { status: 400 });
    }

    const rewards = await getRewardSummaryForOKRT(okrtId);
    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}