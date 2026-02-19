import type { Config } from 'tailwindcss'

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      colors: {
        base: withOpacity('--bg-base'),
        surface: {
          DEFAULT: withOpacity('--bg-surface'),
          elevated: withOpacity('--bg-elevated'),
          overlay: withOpacity('--bg-overlay'),
        },
        accent: {
          DEFAULT: withOpacity('--accent'),
          hover: withOpacity('--accent-hover'),
        },
        content: {
          primary: withOpacity('--text-primary'),
          secondary: withOpacity('--text-secondary'),
          tertiary: withOpacity('--text-tertiary'),
        },
        edge: {
          subtle: withOpacity('--border-subtle'),
          DEFAULT: withOpacity('--border-default'),
          hover: withOpacity('--border-hover'),
        },
        success: withOpacity('--success'),
        danger: {
          DEFAULT: withOpacity('--error'),
          hover: withOpacity('--error-hover'),
        },
        info: withOpacity('--info'),
      },
    },
  },
  plugins: [],
}

export default config
