// lib/adminAuth.js
// Admin authentication helper for server-side route protection

/**
 * Check if the request has a valid admin authentication cookie
 * @param {Request} request - Next.js request object
 * @returns {boolean} - True if admin is authenticated
 */
export function isAdminAuthenticated(request) {
  try {
    const cookie = request.cookies.get('admin_auth');
    if (!cookie || cookie.value !== '1') {
      return false;
    }
    return true;
  } catch (e) {
    console.error('Admin auth check error:', e);
    return false;
  }
}

/**
 * Verify admin password against environment variable
 * @param {string} password - Password to verify
 * @returns {boolean} - True if password matches ADMIN_PW
 */
export function verifyAdminPassword(password) {
  if (!process.env.ADMIN_PW) {
    console.warn('ADMIN_PW environment variable not set');
    return false;
  }
  return password === process.env.ADMIN_PW;
}
