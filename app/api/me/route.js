import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase, getUserByEmail } from '@/lib/db';
import { getServerSession } from 'next-auth';
import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';

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

export async function GET(request) {
  try {
    console.log('=== /api/me endpoint called ===');
    
    // Check what cookies we have
    const cookies = request.headers.get('cookie') || '';
    console.log('Request cookies:', cookies ? 'Present' : 'None');
    
    // Try custom session first (for email/password login)
    let session = await getSession();
    let user = null;
    const database = await getDatabase();
    
    console.log('Custom session result:', session ? 'Found' : 'Not found');
    
    if (session) {
      console.log('Custom session sub:', session.sub);
      // Custom JWT session
      user = await database.get('SELECT * FROM users WHERE id = ?', [session.sub]);
      console.log('User from custom session:', user ? `Found: ${user.email}` : 'Not found');
    } else {
      // Try NextAuth session (for Microsoft login)
      console.log('Trying NextAuth session...');
      const nextAuthSession = await getServerSession(nextAuthOptions);
      console.log('NextAuth session:', nextAuthSession ? `Found: ${nextAuthSession.user?.email}` : 'Not found');
      
      if (nextAuthSession?.user?.email) {
        user = await getUserByEmail(nextAuthSession.user.email);
        console.log('User from NextAuth email:', user ? `Found: ${user.email}` : 'Not found');
      }
    }
    
    if (!user) {
      console.log('No user found, returning 401');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    console.log('Returning user:', user.email);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
        authProvider: user.auth_provider,
        microsoftId: user.microsoft_id,
        preferences: user.preferences,
      }
    });

  } catch (error) {
    console.error('Me endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
