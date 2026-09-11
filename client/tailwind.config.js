/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:        '#F59E0B',
          'primary-dark': '#D97706',
          ink:            '#0F172A',
          muted:          '#64748B',
          border:         '#E2E8F0',
          surface:        '#FFFFFF',
          bg:             '#F3EEE3',
          success:        '#34D399',
          danger:         '#EF4444',
          warning:        '#F97316',
          info:           '#3B82F6',
          'ink-dark':     '#F1F5F9',
          'muted-dark':   '#94A3B8',
          'border-dark':  '#1E293B',
          'surface-dark': '#0F172A',
          'bg-dark':      '#020617',
        },
      },
    },
  },
  plugins: [],
}