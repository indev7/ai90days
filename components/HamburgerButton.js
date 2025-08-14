'use client';

/**
 * @typedef {Object} HamburgerButtonProps
 * @property {boolean} isOpen - Whether the menu is open
 * @property {function} onClick - Click handler
 * @property {string} [className] - Additional CSS classes
 */

/**
 * Accessible hamburger menu button
 * @param {HamburgerButtonProps} props
 */
export default function HamburgerButton({ isOpen, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`hamburger-button ${className}`}
      onClick={onClick}
      aria-controls="mobile-menu"
      aria-expanded={isOpen}
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isOpen ? (
          <>
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </>
        ) : (
          <>
            <path d="M3 12h18" />
            <path d="M3 6h18" />
            <path d="M3 18h18" />
          </>
        )}
      </svg>
    </button>
  );
}
