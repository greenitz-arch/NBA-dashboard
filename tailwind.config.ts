import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      // Tailwind's built-in scale only has named weights (font-bold, font-extrabold,
      // etc). This codebase uses numeric classes like font-600/700/800 throughout —
      // without this, those classes don't exist and silently produce no CSS at all,
      // so every "bold" heading site-wide was quietly rendering at the browser's
      // default weight (400) instead of the intended weight.
      fontWeight: {
        '400': '400',
        '500': '500',
        '600': '600',
        '700': '700',
        '800': '800',
        '900': '900',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
