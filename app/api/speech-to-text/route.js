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

    // Basic validation to avoid sending empty/corrupted blobs
    const fileSize = audioFile.size || audioFile.length || 0;
    if (!fileSize) {
      console.error('Speech-to-text: received empty audio file');
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
    }

    // Ensure we send a proper File with a name and content type (some OpenAI models are strict)
    const normalizedFile = new File(
      [audioFile],
      audioFile.name || 'audio.webm',
      { type: audioFile.type || 'audio/webm' }
    );

    // Choose default model; some containers (e.g., webm/opus) are more reliably handled by whisper-1
    const isWebm = (normalizedFile.type || '').includes('webm');
    const primaryModel = isWebm ? 'whisper-1' : 'gpt-4o-mini-transcribe';
    const primaryFormData = new FormData();
    primaryFormData.append('file', normalizedFile);
    primaryFormData.append('model', primaryModel);
    primaryFormData.append('language', 'en'); // Can be made dynamic if needed
    primaryFormData.append('response_format', 'json');

    const callOpenAI = async (formData, modelLabel) => {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Whisper API error (${modelLabel}):`, errorText);
        return { ok: false, status: response.status, text: errorText };
      }
      return { ok: true, data: await response.json() };
    };

    // Attempt primary model; fallback to whisper-1 on known file errors
    let resultResponse = await callOpenAI(primaryFormData, primaryModel);
    if (!resultResponse.ok && resultResponse.text?.includes('"param": "file"') && primaryModel !== 'whisper-1') {
      const fallbackFormData = new FormData();
      fallbackFormData.append('file', normalizedFile);
      fallbackFormData.append('model', 'whisper-1');
      fallbackFormData.append('language', 'en');
      fallbackFormData.append('response_format', 'json');
      resultResponse = await callOpenAI(fallbackFormData, 'whisper-1 (fallback after file error)');
    }

    if (!resultResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to transcribe audio', details: resultResponse.text || 'Unknown error' },
        { status: resultResponse.status || 500 }
      );
    }

    const result = resultResponse.data;
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
