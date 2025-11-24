// Centralized server-side sanitization layer
// Patches Request.json() and NextResponse.json() to sanitize incoming/outgoing JSON
import sanitizeHtml from 'sanitize-html';
import { NextResponse } from 'next/server';

const DEFAULT_OPTIONS = {
  allowedTags: [
    'b','i','em','strong','u','a','p','br','ul','ol','li',
    'table','thead','tbody','tr','td','th','h1','h2','h3','pre','code'
  ],
  allowedAttributes: {
    a: ['href','name','target','rel'],
    '*': ['class','id','data-*','title']
  },
  allowedSchemes: ['http','https','mailto','tel'],
  allowProtocolRelative: false,
  // Disallow any inline event handlers by default
  transformTags: {
    'a': (tagName, attribs) => {
      // sanitize href scheme
      const href = attribs.href || '';
      try {
        const proto = href.split(':')[0].toLowerCase();
        if (proto && !['http','https','mailto','tel'].includes(proto)) {
          delete attribs.href;
        }
      } catch (e) {
        delete attribs.href;
      }
      // force safe rel/target
      attribs.rel = 'noopener noreferrer';
      attribs.target = '_blank';
      return { tagName, attribs };
    }
  }
};

function isPlainObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]';
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  if (str.trim() === '') return str;
  try {
    return sanitizeHtml(str, DEFAULT_OPTIONS);
  } catch (e) {
    // On any failure, fallback to basic escaping
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

function sanitizeObject(obj, seen = new WeakSet()) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(v => sanitizeObject(v, seen));
  if (typeof obj === 'object') {
    if (seen.has(obj)) return obj;
    seen.add(obj);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      // preserve binary-like values
      if (v && (v instanceof Uint8Array || v instanceof ArrayBuffer)) {
        out[k] = v;
        continue;
      }
      out[k] = sanitizeObject(v, seen);
    }
    return out;
  }
  return obj;
}

// Patch Request.prototype.json to sanitize incoming JSON payloads
try {
  const originalRequestJson = Request.prototype.json;
  if (originalRequestJson && !originalRequestJson.__sanitizer_patched) {
    Request.prototype.json = async function(...args) {
      const data = await originalRequestJson.apply(this, args);
      try {
        return sanitizeObject(data);
      } catch (e) {
        return data;
      }
    };
    Request.prototype.json.__sanitizer_patched = true;
  }
} catch (e) {
  // In some environments Request.prototype may not be writable; ignore
}

// Patch Request.prototype.text to sanitize raw text payloads
try {
  const originalRequestText = Request.prototype.text;
  if (originalRequestText && !originalRequestText.__sanitizer_patched) {
    Request.prototype.text = async function(...args) {
      const data = await originalRequestText.apply(this, args);
      try {
        return sanitizeString(data);
      } catch (e) {
        return data;
      }
    };
    Request.prototype.text.__sanitizer_patched = true;
  }
} catch (e) {
  // ignore
}

// Patch NextResponse.json to sanitize outgoing JSON responses
try {
  if (NextResponse && NextResponse.json && !NextResponse.json.__sanitizer_patched) {
    const originalNextJson = NextResponse.json;
    NextResponse.json = function(body, init) {
      try {
        const sanitized = sanitizeObject(body);
        return originalNextJson.call(NextResponse, sanitized, init);
      } catch (e) {
        return originalNextJson.call(NextResponse, body, init);
      }
    };
    NextResponse.json.__sanitizer_patched = true;
  }
} catch (e) {
  // ignore
}

// Export helpers for explicit use where needed
export { sanitizeHtml as rawSanitize, sanitizeString, sanitizeObject };
