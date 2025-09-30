import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    console.log('=== /api/me endpoint called (simplified) ===');
    
    return NextResponse.json({
      user: null,
      message: 'Simplified response for testing'
    });

  } catch (error) {
    console.error('Me endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}