# Security Violations Report
**Date:** December 9, 2025  
**Codebase:** ai90days (90 Days Goal & Coaching App)  
**Branch:** ollama

---

## Executive Summary

This report identifies security violations found in the codebase based on secure coding practices and guidelines. The issues range from **CRITICAL** to **LOW** severity and require immediate attention to prevent potential security breaches.

### Severity Distribution
- 🔴 **CRITICAL:** 5 issues
- 🟠 **HIGH:** 8 issues  
- 🟡 **MEDIUM:** 6 issues
- 🔵 **LOW:** 4 issues

---

## 🔴 CRITICAL SEVERITY ISSUES

### 1. Hardcoded Secrets in .env.local (Committed to Repository)
**File:** `.env.local`  
**Lines:** 5, 29, 38, 40, 43

**Issue:**
```bash
SESSION_SECRET=your-super-secret-session-key-change-this-in-production-to-a-long-random-string
NEXTAUTH_SECRET=your-super-long-random-nextauth-secret-key-for-sessions
OPEN_AI_API_KEY=abcd
ADMIN_PW=admin123
DATABASE_URL="postgresql://neondb_owner:npg_bN4fWrL2vjAO@..."
```

**Risk:** Exposed secrets can lead to unauthorized access, session hijacking, and database breaches.

**Recommendation:**
- Remove `.env.local` from version control (add to `.gitignore`)
- Use environment-specific secrets management (AWS Secrets Manager, Azure Key Vault)
- Rotate all exposed credentials immediately
- Use `.env.example` with placeholder values instead

---

### 2. Weak Admin Password Default
**File:** `.env.local`  
**Line:** 40

**Issue:**
```bash
ADMIN_PW=admin123
```

**Risk:** Trivial password allows unauthorized admin access. Brute force would crack this in seconds.

**Recommendation:**
- Remove hardcoded admin password
- Implement proper admin authentication with strong password requirements
- Use role-based access control (RBAC) from database
- Enforce MFA for admin accounts

---

### 3. XSS Vulnerability - Unescaped HTML Rendering
**File:** `app/coach/page.js`  
**Line:** 525

**Issue:**
```javascript
<div ref={containerRef} className={styles.actionForms} 
     dangerouslySetInnerHTML={{ __html: htmlContent }} />
```

**File:** `components/DailyInspirationCard.js`  
**Lines:** 79, 111

**Issue:**
```javascript
dangerouslySetInnerHTML={{ __html: shortContent }}
dangerouslySetInnerHTML={{ __html: longContent || shortContent }}
```

**Risk:** Allows arbitrary JavaScript execution if LLM output or CMS content is compromised. This is a **stored XSS** vulnerability.

**Recommendation:**
- Use DOMPurify to sanitize HTML before rendering:
  ```javascript
  import DOMPurify from 'isomorphic-dompurify';
  const sanitizedHTML = DOMPurify.sanitize(htmlContent);
  ```
- Alternatively, use React components instead of raw HTML
- Implement Content Security Policy (CSP) headers

---

### 4. Missing CSRF Protection
**Files:** All API routes

**Issue:** No CSRF tokens implemented for state-changing operations (POST, PUT, DELETE)

**Risk:** Attackers can trick authenticated users into performing unwanted actions.

**Recommendation:**
- Implement CSRF tokens for all state-changing requests
- Use Next.js middleware to validate tokens
- For same-site requests, use `SameSite=Strict` cookies
- Example implementation:
  ```javascript
  // middleware.js
  import { NextResponse } from 'next/server';
  import { verifyCSRFToken } from './lib/csrf';
  
  export function middleware(request) {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      const token = request.headers.get('x-csrf-token');
      if (!verifyCSRFToken(token)) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }
    }
    return NextResponse.next();
  }
  ```

---

### 5. Database Connection String Exposure
**File:** `.env.local`  
**Line:** 43

**Issue:**
```bash
DATABASE_URL="postgresql://neondb_owner:npg_bN4fWrL2vjAO@ep-blue-lab-a1l4uics-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

**Risk:** Full database credentials exposed, allowing direct database access and data exfiltration.

**Recommendation:**
- Immediately rotate database credentials
- Use connection pooling with limited privileges
- Implement database role-based access
- Use IAM authentication instead of password auth (if supported by Neon)

---

## 🟠 HIGH SEVERITY ISSUES

### 6. Missing Rate Limiting
**Files:** All API routes

**Issue:** No rate limiting implemented on any endpoints.

**Risk:** 
- Brute force attacks on `/api/login`
- DoS attacks overwhelming the LLM endpoint
- API abuse and resource exhaustion

**Recommendation:**
Implement rate limiting middleware:
```javascript
// lib/rateLimit.js
import { LRUCache } from 'lru-cache';

const tokenCache = new LRUCache({
  max: 500,
  ttl: 60000, // 1 minute
});

export function rateLimit(limit = 10) {
  return async (request) => {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const tokenCount = tokenCache.get(ip) || 0;
    
    if (tokenCount >= limit) {
      return new Response('Too many requests', { status: 429 });
    }
    
    tokenCache.set(ip, tokenCount + 1);
  };
}
```

Apply to sensitive endpoints:
- `/api/login`: 5 requests/minute
- `/api/signup`: 3 requests/hour
- `/api/llm`: 10 requests/minute

---

### 7. Missing Security Headers
**File:** `next.config.mjs`

**Issue:** No security headers configured.

**Risk:** Vulnerable to clickjacking, MIME sniffing, XSS, and other attacks.

**Recommendation:**
```javascript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Restrict as much as possible
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://login.microsoftonline.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

### 8. Insufficient Password Policy
**File:** `lib/auth.js`  
**Lines:** 95-107

**Issue:**
```javascript
if (!password || password.trim().length < 8) {
  return 'Password must be 8+ characters and include at least one letter and one number.';
}
```

**Risk:** Weak passwords allow brute force attacks.

**Recommendation:**
Strengthen password requirements:
```javascript
export function validatePassword(password) {
  if (!password || password.trim().length < 12) {
    return 'Password must be at least 12 characters';
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strength = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (strength < 3) {
    return 'Password must include uppercase, lowercase, number, and special character';
  }
  
  // Check against common passwords
  const commonPasswords = ['password123', 'admin123', 'qwerty123'];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    return 'Password is too common';
  }
  
  return null;
}
```

---

### 9. No Account Lockout Mechanism
**Files:** `/api/login/route.js`

**Issue:** No protection against brute force login attempts.

**Risk:** Attackers can attempt unlimited login attempts.

**Recommendation:**
Implement account lockout:
```javascript
// lib/loginAttempts.js
const attempts = new Map();

export function recordFailedLogin(email) {
  const current = attempts.get(email) || { count: 0, lockedUntil: null };
  current.count++;
  current.lastAttempt = Date.now();
  
  if (current.count >= 5) {
    current.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
  }
  
  attempts.set(email, current);
}

export function isAccountLocked(email) {
  const attempt = attempts.get(email);
  if (!attempt?.lockedUntil) return false;
  
  if (Date.now() > attempt.lockedUntil) {
    attempts.delete(email);
    return false;
  }
  
  return true;
}

export function clearFailedLogins(email) {
  attempts.delete(email);
}
```

---

### 10. Insecure Cookie Configuration
**File:** `lib/auth.js`  
**Lines:** 19-24

**Issue:**
```javascript
cookieStore.set('sid', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
});
```

**Risk:** `sameSite: 'lax'` allows CSRF in some scenarios. No `domain` attribute.

**Recommendation:**
```javascript
cookieStore.set('sid', token, {
  httpOnly: true,
  secure: true, // Always use secure in production
  sameSite: 'strict', // Prevent CSRF
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
  domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined,
});
```

---

### 11. JWT Secret in Environment Variable
**File:** `lib/auth.js`  
**Line:** 5

**Issue:**
```javascript
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
```

**Risk:** If `.env.local` is exposed, JWT tokens can be forged.

**Recommendation:**
- Use a secrets management service (AWS Secrets Manager, Azure Key Vault)
- Rotate secrets regularly
- Use separate secrets for different environments
- Consider using asymmetric keys (RS256) instead of symmetric (HS256)

---

### 12. Missing Input Validation on LLM Endpoint
**File:** `app/api/llm/route.js`

**Issue:** User messages sent directly to LLM without sanitization or length limits.

**Risk:**
- Prompt injection attacks
- Resource exhaustion
- Jailbreaking attempts

**Recommendation:**
```javascript
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, okrtContext } = await request.json();
    
    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }
    
    // Limit message count
    if (messages.length > 50) {
      return NextResponse.json({ error: 'Too many messages' }, { status: 400 });
    }
    
    // Validate and sanitize each message
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
      }
      
      if (msg.content.length > 10000) {
        return NextResponse.json({ error: 'Message too long' }, { status: 400 });
      }
      
      // Sanitize content
      msg.content = DOMPurify.sanitize(msg.content, { ALLOWED_TAGS: [] });
    }
    
    // Continue with LLM processing...
  } catch (error) {
    console.error('LLM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

### 13. No Logging and Monitoring
**Files:** All API routes

**Issue:** Insufficient security event logging and monitoring.

**Risk:** Cannot detect or respond to security incidents.

**Recommendation:**
Implement security logging:
```javascript
// lib/securityLogger.js
export function logSecurityEvent(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    type: event.type,
    userId: event.userId,
    ip: event.ip,
    userAgent: event.userAgent,
    details: event.details,
  };
  
  // Log to external service (Datadog, Sentry, CloudWatch)
  console.log('[SECURITY]', JSON.stringify(entry));
  
  // Send to SIEM if critical
  if (event.severity === 'critical') {
    // sendToSIEM(entry);
  }
}

// Usage
logSecurityEvent({
  type: 'FAILED_LOGIN',
  userId: email,
  ip: request.ip,
  severity: 'medium',
  details: { attempts: 3 }
});
```

Log these events:
- Failed login attempts
- Account lockouts
- Password changes
- Admin actions
- Unusual API access patterns

---

## 🟡 MEDIUM SEVERITY ISSUES

### 14. Insufficient Session Timeout
**File:** `lib/auth.js`  
**Line:** 16

**Issue:**
```javascript
.setExpirationTime('7d')
```

**Risk:** 7-day session timeout is too long, increasing window for session hijacking.

**Recommendation:**
- Reduce to 24 hours for regular users
- Implement sliding session renewal
- Force re-authentication for sensitive operations
- Add "Remember Me" option for extended sessions

```javascript
// For regular session
.setExpirationTime('24h')

// For "Remember Me"
.setExpirationTime(rememberMe ? '30d' : '24h')
```

---

### 15. Missing API Response Size Limits
**Files:** All API routes

**Issue:** No limits on response sizes, especially for `/api/okrt` and `/api/llm`.

**Risk:** Resource exhaustion and DoS through large responses.

**Recommendation:**
```javascript
// middleware.js
export function middleware(request) {
  // Limit request body size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 1_000_000) { // 1MB
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }
  
  return NextResponse.next();
}
```

---

### 16. Insecure Direct Object References (IDOR)
**Files:** `/api/okrt/[id]/route.js`, `/api/comments/[id]/route.js`

**Issue:** Some endpoints check ownership, but validation could be more robust.

**Risk:** Users might access or modify resources they don't own.

**Recommendation:**
Ensure every sensitive endpoint validates ownership:
```javascript
export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const resource = await getResourceById(id);

  if (!resource) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // CRITICAL: Verify ownership
  if (resource.owner_id !== parseInt(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Continue with update...
}
```

---

### 17. Missing Email Verification
**File:** `/api/signup/route.js`

**Issue:** Users can sign up without email verification.

**Risk:**
- Fake account creation
- Spam and abuse
- Account takeover via email typos

**Recommendation:**
Implement email verification flow:
1. Send verification email on signup
2. Store `email_verified` flag in database
3. Restrict access until verified
4. Add `/api/verify-email` endpoint

---

### 18. No Token Refresh Mechanism
**File:** `lib/auth.js`

**Issue:** JWT tokens have fixed expiration with no refresh mechanism.

**Risk:** Users must re-login frequently, poor UX, or use dangerously long expirations.

**Recommendation:**
Implement refresh tokens:
```javascript
// Generate access token (short-lived) and refresh token (long-lived)
export async function createSession(user) {
  const accessToken = await new SignJWT({ ... })
    .setExpirationTime('15m')
    .sign(secret);
    
  const refreshToken = await new SignJWT({ sub: user.id, type: 'refresh' })
    .setExpirationTime('30d')
    .sign(secret);
  
  // Store refresh token in database
  await storeRefreshToken(user.id, refreshToken);
  
  // Set cookies
  cookieStore.set('access_token', accessToken, { maxAge: 900 });
  cookieStore.set('refresh_token', refreshToken, { maxAge: 2592000, httpOnly: true });
}
```

---

### 19. Inadequate Error Handling
**Files:** Multiple API routes

**Issue:** Error messages may leak sensitive information.

**Example:**
```javascript
console.error('Signup error:', error);
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
```

**Risk:** Stack traces and error details could expose system information.

**Recommendation:**
```javascript
export async function POST(request) {
  try {
    // ... operation
  } catch (error) {
    // Log full error internally
    logger.error('Signup error', {
      error: error.message,
      stack: error.stack,
      userId: session?.sub,
    });
    
    // Return generic error to client
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
```

---

## 🔵 LOW SEVERITY ISSUES

### 20. Weak Email Validation
**File:** `lib/auth.js`  
**Line:** 109

**Issue:**
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

**Risk:** Allows invalid email formats.

**Recommendation:**
Use a more robust regex or library:
```javascript
export function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

// Or use a library
import validator from 'validator';
export function validateEmail(email) {
  return validator.isEmail(email);
}
```

---

### 21. Console Logging in Production
**Files:** Multiple files

**Issue:** Excessive `console.log()` statements that may log sensitive data.

**Risk:** Sensitive information in logs could be accessed by unauthorized parties.

**Recommendation:**
```javascript
// lib/logger.js
const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  debug: (...args) => !isProd && console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

// Replace all console.log with logger
logger.debug('Debug info', data);
```

---

### 22. Missing Request ID Tracking
**Files:** All API routes

**Issue:** No unique request IDs for tracking and debugging.

**Risk:** Difficult to trace security incidents and debug issues.

**Recommendation:**
```javascript
// middleware.js
import { v4 as uuidv4 } from 'uuid';

export function middleware(request) {
  const requestId = uuidv4();
  request.headers.set('x-request-id', requestId);
  
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  
  return response;
}
```

---

### 23. No API Versioning
**Files:** All API routes

**Issue:** API endpoints have no versioning scheme.

**Risk:** Breaking changes affect all clients simultaneously.

**Recommendation:**
Implement API versioning:
```
/api/v1/okrt
/api/v1/llm
/api/v1/comments
```

---

## 🎯 Immediate Action Items

### Priority 1 (This Week)
1. ✅ Remove `.env.local` from repository and rotate all exposed credentials
2. ✅ Implement XSS sanitization with DOMPurify
3. ✅ Add CSRF protection
4. ✅ Implement rate limiting on login and signup

### Priority 2 (Next Sprint)
5. ✅ Add security headers in `next.config.mjs`
6. ✅ Strengthen password policy
7. ✅ Implement account lockout mechanism
8. ✅ Add input validation on LLM endpoint

### Priority 3 (Within Month)
9. ✅ Implement proper secrets management
10. ✅ Add comprehensive security logging
11. ✅ Implement email verification
12. ✅ Add token refresh mechanism

### Priority 4 (Ongoing)
13. ✅ Security code review for new features
14. ✅ Regular dependency updates
15. ✅ Penetration testing
16. ✅ Security awareness training

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## 🔍 Automated Security Tools Recommended

1. **Snyk** - Dependency vulnerability scanning
2. **GitHub Dependabot** - Automated dependency updates
3. **SonarQube** - Code quality and security analysis
4. **OWASP ZAP** - Dynamic application security testing
5. **npm audit** - Node.js dependency auditing
6. **ESLint Security Plugin** - Static code analysis

---

**Report Generated By:** GitHub Copilot  
**Review Status:** Pending Security Team Review  
**Next Review Date:** December 16, 2025
