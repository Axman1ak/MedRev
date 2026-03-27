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
        bg: '#fafaf8',
        bg2: '#f5f4f0',
        bg3: '#edeae3',
        card: '#ffffff',
        border: '#e2dfd8',
        accent: '#2d6a4f',
        accent2: '#1b4332',
        accent3: '#f59e6b',
        danger: '#dc2626',
        gold: '#d97706',
        purple: '#6d28d9',
        t1: '#1a1a18',
        t2: '#4a4a46',
        t3: '#9b9890',
      },
      fontFamily: {
        syne: ['Fraunces', 'serif'],
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
 
