import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0d0f14',
        bg2: '#13161e',
        bg3: '#1a1e28',
        card: '#1e2330',
        border: '#2a3045',
        accent: '#4f8ef7',
        accent2: '#6ee7b7',
        accent3: '#f59e6b',
        danger: '#f87171',
        gold: '#f59e0b',
        purple: '#a78bfa',
        t1: '#e8ecf4',
        t2: '#8892aa',
        t3: '#4a5268',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '14px',
      },
    },
  },
  plugins: [],
}
export default config
