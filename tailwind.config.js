/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          soft: '#EEF0FF',
          dark: '#3730A3',
        },
      },
      borderRadius: {
        card: '1.25rem',
        btn: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(24,24,27,.04), 0 4px 14px rgba(24,24,27,.04)',
        pop: '0 8px 30px rgba(24,24,27,.12)',
      },
      fontFamily: {
        ui: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        ru: ['PT Serif', 'Georgia', 'Times New Roman', 'Segoe UI', 'serif'],
      },
      keyframes: {
        pop: { from: { transform: 'translateY(8px) scale(.98)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        pulseDot: { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '.45', transform: 'scale(.75)' } },
      },
      animation: {
        pop: 'pop .18s ease',
        pulseDot: 'pulseDot 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}