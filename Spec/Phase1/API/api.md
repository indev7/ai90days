## 🔌 API Endpoints (App Router route handlers)
- **POST `/api/signup`** → Body `{ username, password, displayName, email? }` → creates user.  
- **POST `/api/login`** → Body `{ username, password }` → verifies, sets session cookie.  
- **GET `/api/me`** → Returns `{ user }` if signed in; 401 if not.

**Notes**
- Validate input; return `400` on invalid; `409` on duplicate username/email.  
- Passwords are **never** stored raw; hash on server.  
- Session cookie: httpOnly, secure in prod, reasonable expiry.
