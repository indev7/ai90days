import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/pgdb';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY
});

export async function POST(request) {
  try {
    const { text, voice, model = 'tts-1' } = await request.json();
    
    // Get user's preferred voice if not explicitly provided
    let selectedVoice = voice || 'alloy';
    
    if (!voice) {
      try {
        const session = await getSession();
        if (session) {
          const user = await getUserById(session.sub);
          
          if (user?.preferences) {
            const preferences = JSON.parse(user.preferences);
            selectedVoice = preferences.preferred_voice || 'alloy';
          }
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
        // Continue with default voice if there's an error
      }
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Generate speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model,
      voice: selectedVoice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}