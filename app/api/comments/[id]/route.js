import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import {
  getCommentById,
  updateComment,
  deleteComment,
  getReplies,
  getDatabase,
  getUserByEmail
} from '../../../../lib/db';

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
  const database = await getDatabase();
  
  if (session) {
    // Custom JWT session
    user = await database.get('SELECT * FROM users WHERE id = ?', [session.sub]);
  } else {
    // Try NextAuth session (for Microsoft login)
    const nextAuthSession = await getServerSession(nextAuthOptions);
    
    if (nextAuthSession?.user?.email) {
      user = await getUserByEmail(nextAuthSession.user.email);
    }
  }
  
  return user;
}

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const includeReplies = searchParams.get('includeReplies') === 'true';

    const comment = await getCommentById(id);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    let replies = [];
    if (includeReplies) {
      replies = await getReplies(id);
    }

    return NextResponse.json({ comment, replies });
  } catch (error) {
    console.error('Error fetching comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Get the existing comment to check ownership
    const existingComment = await getCommentById(id);
    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the sender can update their comment
    if (existingComment.sending_user !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow updating the comment text for text type comments
    if (existingComment.type === 'text' && body.comment) {
      const updatedComment = await updateComment(id, { 
        comment: body.comment.trim() 
      });
      return NextResponse.json({ comment: updatedComment });
    } else {
      return NextResponse.json({ 
        error: 'Only text comments can be updated' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get the existing comment to check ownership
    const existingComment = await getCommentById(id);
    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the sender can delete their comment
    if (existingComment.sending_user !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteComment(id);
    return NextResponse.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}