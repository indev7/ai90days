import { verifyToken } from '@/lib/auth';
import { getUnreadNotificationCount } from '@/lib/db';

// Store active connections
const connections = new Map();

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Store the connection
        connections.set(user.id, controller);

        // Send initial connection message
        const data = `data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));

        // Send initial unread count
        getUnreadNotificationCount(user.id).then(count => {
          const countData = `data: ${JSON.stringify({ type: 'unread_count', count })}\n\n`;
          controller.enqueue(new TextEncoder().encode(countData));
        });

        // Set up heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            const heartbeatData = `data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeatData));
          } catch (error) {
            clearInterval(heartbeat);
            connections.delete(user.id);
          }
        }, 30000); // Send heartbeat every 30 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          connections.delete(user.id);
          controller.close();
        });
      },
      cancel() {
        connections.delete(user.id);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Function to broadcast notification to a specific user
export function broadcastToUser(userId, notification) {
  const controller = connections.get(userId);
  if (controller) {
    try {
      const data = `data: ${JSON.stringify({ type: 'notification', notification })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      console.error('Error broadcasting to user:', error);
      connections.delete(userId);
    }
  }
}

// Function to broadcast unread count update to a specific user
export function broadcastUnreadCount(userId, count) {
  const controller = connections.get(userId);
  if (controller) {
    try {
      const data = `data: ${JSON.stringify({ type: 'unread_count', count })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      console.error('Error broadcasting unread count:', error);
      connections.delete(userId);
    }
  }
}