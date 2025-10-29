import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import {
  createComment,
  getCommentsByOKRT,
  getCommentsByUser,
  getUserById,
  getUserByEmail,
  getOKRTById
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
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'sent'; // 'sent' or 'received'

    if (okrtId) {
      // Get comments for a specific OKRT
      const comments = await getCommentsByOKRT(okrtId);
      return NextResponse.json({ comments });
    } else if (userId) {
      // Get comments by user (sent or received)
      const comments = await getCommentsByUser(userId, type);
      return NextResponse.json({ comments });
    } else {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      comment, 
      parent_comment_id, 
      type = 'text', 
      count = 1, 
      receiving_user, 
      okrt_id 
    } = body;

    // Validate required fields
    if (!receiving_user || !okrt_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: receiving_user, okrt_id' 
      }, { status: 400 });
    }

    // Validate comment content for text type
    if (type === 'text' && (!comment || comment.trim().length === 0)) {
      return NextResponse.json({ 
        error: 'Comment text is required for text type comments' 
      }, { status: 400 });
    }

    // Validate reward types and count
    const validRewardTypes = ['medal', 'cookie', 'star'];
    if (validRewardTypes.includes(type)) {
      if (count < 1 || count > 5) {
        return NextResponse.json({ 
          error: 'Reward count must be between 1 and 5' 
        }, { status: 400 });
      }
    }

    // Validate type
    const validTypes = ['text', 'medal', 'cookie', 'star'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        error: 'Invalid comment type'
      }, { status: 400 });
    }

    // Prevent users from giving rewards to their own objectives
    if (validRewardTypes.includes(type)) {
      const okrt = await getOKRTById(okrt_id);
      
      if (!okrt) {
        return NextResponse.json({
          error: 'OKRT not found'
        }, { status: 404 });
      }
      
      if (okrt.owner_id === user.id.toString()) {
        return NextResponse.json({
          error: 'You cannot give rewards to your own objectives'
        }, { status: 403 });
      }
    }

    const commentData = {
      comment: comment?.trim() || null,
      parent_comment_id,
      type,
      count: validRewardTypes.includes(type) ? count : 1,
      sending_user: user.id,
      receiving_user,
      okrt_id
    };

    const newComment = await createComment(commentData);
    
    // Return response with cache update instruction
    return NextResponse.json({
      comment: newComment,
      _cacheUpdate: {
        action: 'updateComment',
        data: { okrtId: okrt_id, comment: newComment }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}