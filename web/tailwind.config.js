/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#0E7C6B', dark: '#0A6355' },
        mint: '#E6F4F1',
        ink: '#101828',
        body: '#475467',
        muted: '#667085',
        line: '#E4E7EC',
        canvas: '#F9FAFB',
        amber: { DEFAULT: '#B54708', bg: '#FFFAEB' },
        red: { DEFAULT: '#B42318', bg: '#FEF3F2' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '8px', modal: '12px', input: '6px' },
      boxShadow: {
        lift: '0 4px 12px rgba(16,24,40,0.08)',
        drag: '0 16px 32px rgba(16,24,40,0.18)',
      },
    },
  },
  plugins: [],
};
