import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { getUserByEmail, createUser, run } from '@/lib/pgdb';
import { createSession } from '@/lib/auth';

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID,
      authorization: {
        params: {
          scope: "openid profile email User.Read"
        }
      }
    }),
  ],
  debug: true,
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('SignIn callback:', { user, account: account?.provider, profile });
      
      if (account.provider === 'azure-ad') {
        try {
          // Check if user exists by email
          let existingUser = await getUserByEmail(user.email);
          
          if (existingUser) {
            // Link Microsoft account to existing user
            console.log('Linking Microsoft account to existing user:', existingUser.id);
            await run(
              `UPDATE users SET
                microsoft_id = ?,
                first_name = ?,
                last_name = ?,
                profile_picture_url = ?,
                auth_provider = ?,
                updated_at = ?
              WHERE id = ?`,
              [
                user.id, // Microsoft user ID from NextAuth
                profile.given_name || profile.name?.split(' ')[0] || '',
                profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
                user.image || '',
                'microsoft',
                new Date().toISOString(),
                existingUser.id
              ]
            );
          } else {
            // Create new user with Microsoft data
            console.log('Creating new user for Microsoft account');
            const displayName = user.name || user.email.split('@')[0];
            
            existingUser = await createUser({
              email: user.email,
              password_hash: 'MICROSOFT_AUTH', // Placeholder for Microsoft-only accounts
              display_name: displayName,
            });
            
            // Add Microsoft-specific data
            await run(
              `UPDATE users SET
                microsoft_id = ?,
                first_name = ?,
                last_name = ?,
                profile_picture_url = ?,
                auth_provider = ?
              WHERE id = ?`,
              [
                user.id,
                profile.given_name || profile.name?.split(' ')[0] || '',
                profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
                user.image || '',
                'microsoft',
                existingUser.id
              ]
            );
          }
          
          // Create our custom JWT session for the Microsoft user
          await createSession(existingUser);
          console.log('Microsoft sign-in completed successfully');
          return true;
        } catch (error) {
          console.error('Microsoft sign-in error:', error);
          return false;
        }
      }
      
      return true;
    },
    
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        // Store additional user data in JWT
        token.userId = user.id;
        token.email = user.email;
        
        if (account.provider === 'azure-ad') {
          token.provider = 'microsoft';
          token.microsoftId = profile.sub;
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      // Add user data to session
      session.user.id = token.userId;
      session.user.provider = token.provider;
      session.user.microsoftId = token.microsoftId;
      
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      console.log('Redirect callback:', { url, baseUrl });
      
      // If redirecting to login page, allow it (for logout)
      if (url.includes('/login')) {
        return url;
      }
      
      // Otherwise redirect to dashboard after Microsoft login
      return baseUrl + '/dashboard';
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});

export { handler as GET, handler as POST };
