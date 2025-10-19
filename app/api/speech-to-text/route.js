// app/api/speech-to-text/route.js
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the audio file from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Prepare form data for OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en'); // Can be made dynamic if needed
    whisperFormData.append('response_format', 'json');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: whisperFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to transcribe audio', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({
      text: result.text || '',
      success: true
    });

  } catch (error) {
    console.error('Speech-to-text error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio', details: error.message },
      { status: 500 }
    );
  }
}