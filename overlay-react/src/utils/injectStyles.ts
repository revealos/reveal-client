/**
 * Injects CSS styles into the document head.
 * Idempotent - only injects once even if called multiple times.
 */

const STYLE_ID = 'reveal-glass-panel-styles';
const CSS_CONTENT = `
.reveal-glass-panel {
  width: clamp(238px, 34vw, 408px); /* 85% of original (280px->238px, 40vw->34vw, 480px->408px) */

  /* More transparent, still dark tinted */
  background: hsla(240, 15%, 14%, 0.32);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  /* Shape & spacing */
  border-radius: 20px;
  padding: 24px;

  /* Sharper, shinier edges */
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.30) inset,   /* inner depth */
    0 0 8px rgba(255, 255, 255, 0.08),     /* edge shine */
    0 8px 24px rgba(0, 0, 0, 0.40);        /* floating shadow */

  /* Text */
  color: #ffffff;
  text-align: center;
}

.reveal-glass-panel h1,
.reveal-glass-panel h2,
.reveal-glass-panel h3 {
  color: #ffffff;
  text-shadow: 0 0 6px rgba(255, 255, 255, 0.18);
}

.reveal-glass-panel p {
  color: rgba(255, 255, 255, 0.92);
  font-weight: bold;
}

.reveal-glass-panel button {
  cursor: pointer;
}

/* Working float animation */
@keyframes revealFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

.reveal-glass-panel.animate-float {
  animation: revealFloat 6s ease-in-out infinite;
  will-change: transform;
}

.animate-float {
  animation: revealFloat 6s ease-in-out infinite !important;
  will-change: transform;
}
`;

/**
 * Injects the reveal-glass-panel styles into the document head.
 * Safe to call multiple times - will only inject once.
 */
export function injectRevealGlassPanelStyles(): void {
  // Check if styles are already injected
  if (typeof document !== 'undefined' && document.getElementById(STYLE_ID)) {
    return;
  }

  // Only run in browser environment
  if (typeof document === 'undefined') {
    return;
  }

  // Create and inject style tag
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS_CONTENT;
  document.head.appendChild(style);
}

