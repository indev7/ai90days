import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const LOG_FILE_NAME = 'llm_api_req_res.txt';
const START_MARKER = '=== LLM API INTERACTION ===';
const END_MARKER = '=== END LLM API INTERACTION ===';

function tryParseJsonString(value) {
  if (typeof value !== 'string') return { parsed: false, value };
  const trimmed = value.trim();
  if (!trimmed) return { parsed: false, value };
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { parsed: true, value: JSON.parse(trimmed) };
    } catch {
      return { parsed: false, value };
    }
  }
  return { parsed: false, value };
}

function parseSseBody(raw) {
  const events = [];
  const lines = raw.split(/\r?\n/);
  let currentEvent = null;
  let dataLines = [];

  const flush = () => {
    if (!currentEvent && dataLines.length === 0) return;
    const dataStr = dataLines.join('\n');
    const parsedData = (() => {
      const { parsed, value } = tryParseJsonString(dataStr);
      return parsed ? value : dataStr;
    })();
    const eventName = currentEvent || 'message';
    const simplified = simplifySseEvent(eventName, parsedData);
    events.push(simplified);
    currentEvent = null;
    dataLines = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith('event:')) {
      currentEvent = line.slice('event:'.length).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
      continue;
    }
    dataLines.push(line);
  }
  flush();

  const text = events
    .map((evt) => (typeof evt.text === 'string' ? evt.text : ''))
    .join('');

  return { type: 'sse', text, events };
}

function simplifySseEvent(eventName, data) {
  if (eventName.includes('delta')) {
    if (data && typeof data === 'object') {
      if (data.delta && typeof data.delta === 'object') {
        if (typeof data.delta.text === 'string') {
          return { event: eventName, text: data.delta.text };
        }
        if (typeof data.delta.partial_json === 'string') {
          return { event: eventName, tool_input_chunk: data.delta.partial_json };
        }
        if (typeof data.delta.arguments === 'string') {
          return { event: eventName, tool_args_chunk: data.delta.arguments };
        }
      }
      if (typeof data.delta === 'string') {
        return { event: eventName, text: data.delta };
      }
    }
  }

  if (eventName === 'response.output_text.delta' && typeof data?.delta === 'string') {
    return { event: eventName, text: data.delta };
  }

  return { event: eventName, data };
}

function formatBody(body) {
  if (typeof body !== 'string') return body;
  const trimmed = body.trim();
  if (!trimmed) return body;

  const jsonParsed = tryParseJsonString(trimmed);
  if (jsonParsed.parsed) return expandMultilineFields(jsonParsed.value);

  if (trimmed.includes('event:') && trimmed.includes('data:')) {
    return parseSseBody(trimmed);
  }

  return body;
}

function expandMultilineFields(value) {
  if (Array.isArray(value)) {
    return value.map(expandMultilineFields);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string' && val.includes('\n')) {
      if (key === 'system') {
        result.system = val;
        result.system_lines = val.split('\n');
        continue;
      }
      if (key === 'text') {
        result.text = val;
        result.text_lines = val.split('\n');
        continue;
      }
    }
    result[key] = expandMultilineFields(val);
  }

  return result;
}

function formatEntry(entry) {
  const formatted = { ...entry };
  if (formatted.request?.body != null) {
    formatted.request = { ...formatted.request, body: formatBody(formatted.request.body) };
  }
  if (formatted.response?.body != null) {
    formatted.response = { ...formatted.response, body: formatBody(formatted.response.body) };
  }
  return formatted;
}

function parseLogFile(raw) {
  if (!raw) return [];
  const chunks = raw.split(START_MARKER).slice(1);
  const entries = [];

  for (const chunk of chunks) {
    const endIndex = chunk.indexOf(END_MARKER);
    const body = (endIndex >= 0 ? chunk.slice(0, endIndex) : chunk).trim();
    if (!body) continue;
    try {
      entries.push(formatEntry(JSON.parse(body)));
    } catch (error) {
      entries.push({
        parseError: String(error),
        raw: body
      });
    }
  }

  return entries;
}

export async function GET() {
  const logPath = path.join(process.cwd(), LOG_FILE_NAME);
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    const entries = parseLogFile(raw);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to read log file',
        details: String(error)
      },
      { status: 500 }
    );
  }
}
