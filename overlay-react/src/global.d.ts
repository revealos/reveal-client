/**
 * JSX type declarations for Web Components
 *
 * Enables TypeScript support for reveal-overlay-wc Web Components in React.
 */

import * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'reveal-overlay-manager': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'show-quadrants'?: string;
        },
        HTMLElement
      >;
      'reveal-tooltip-nudge': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
