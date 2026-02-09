/**
 * Simple in-memory rate limiter for JIRA API calls
 * For production, consider using Redis or a database
 */

class RateLimiter {
  constructor() {
    // Store: userId -> { count, windowStart }
    this.store = new Map();
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if a user is within rate limits
   * @param {string} userId - User identifier
   * @param {string} resource - Resource being accessed (e.g., 'jira-query')
   * @param {Object} options - Rate limit options
   * @param {number} options.max - Maximum requests allowed
   * @param {string} options.window - Time window (e.g., '1h', '1m')
   * @returns {Promise<boolean>} True if allowed, false if rate limited
   */
  async check(userId, resource, options = {}) {
    const { max = 100, window = '1h' } = options;
    const windowMs = this.parseWindow(window);
    const key = `${userId}:${resource}`;
    const now = Date.now();

    const entry = this.store.get(key);

    // No entry or window expired - allow and create new entry
    if (!entry || now - entry.windowStart > windowMs) {
      this.store.set(key, {
        count: 1,
        windowStart: now,
        max,
        windowMs
      });
      return true;
    }

    // Within window - check count
    if (entry.count < max) {
      entry.count++;
      return true;
    }

    // Rate limited
    return false;
  }

  /**
   * Get remaining requests for a user
   * @param {string} userId - User identifier
   * @param {string} resource - Resource being accessed
   * @returns {Object} { remaining, resetAt }
   */
  getStatus(userId, resource) {
    const key = `${userId}:${resource}`;
    const entry = this.store.get(key);
    
    if (!entry) {
      return { remaining: null, resetAt: null };
    }

    const now = Date.now();
    const resetAt = entry.windowStart + entry.windowMs;
    
    if (now > resetAt) {
      return { remaining: null, resetAt: null };
    }

    return {
      remaining: Math.max(0, entry.max - entry.count),
      resetAt: new Date(resetAt).toISOString()
    };
  }

  /**
   * Parse window string to milliseconds
   * @param {string} window - Time window (e.g., '1h', '30m', '1d')
   * @returns {number} Milliseconds
   */
  parseWindow(window) {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > entry.windowMs) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a user
   * @param {string} userId - User identifier
   * @param {string} resource - Resource being accessed
   */
  reset(userId, resource) {
    const key = `${userId}:${resource}`;
    this.store.delete(key);
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

export default rateLimiter;
