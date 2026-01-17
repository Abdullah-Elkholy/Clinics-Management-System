module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Tajawal', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          500: '#eab308',
          600: '#ca8a04',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      keyframes: {
        modalIn: {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
        glowSending: {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(59, 130, 246, 0.3), 0 0 10px rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
          },
          '50%': {
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.5), 0 0 25px rgba(59, 130, 246, 0.3)',
            borderColor: 'rgba(59, 130, 246, 0.8)',
          },
        },
        glowSuccess: {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(34, 197, 94, 0.3), 0 0 10px rgba(34, 197, 94, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 15px rgba(34, 197, 94, 0.5), 0 0 25px rgba(34, 197, 94, 0.3)',
          },
        },
      },
      animation: {
        'modal-in': 'modalIn 220ms cubic-bezier(.2,.9,.25,1) forwards',
        'slide-in': 'slideIn 180ms cubic-bezier(.2,.9,.25,1) forwards',
        'slide-in-right': 'slideInRight 200ms cubic-bezier(.2,.9,.25,1) forwards',
        'fade-in': 'fadeIn 160ms ease-out forwards',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-sending': 'glowSending 2s ease-in-out infinite',
        'glow-success': 'glowSuccess 2s ease-in-out infinite',
      },
      borderRadius: {
        'xs': '0.25rem',
        'sm': '0.375rem',
        'base': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [
    {
      handler: function ({ addComponents, theme }) {
        addComponents({
          '.btn-primary': {
            '@apply px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-md transition-all duration-200': {},
          },
          '.btn-secondary': {
            '@apply px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-all duration-200': {},
          },
          '.btn-success': {
            '@apply px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200': {},
          },
          '.btn-danger': {
            '@apply px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200': {},
          },
          '.btn-sm': {
            '@apply px-3 py-1 text-sm': {},
          },
          '.btn-lg': {
            '@apply px-6 py-3 text-lg': {},
          },
          '.card': {
            '@apply bg-white rounded-lg border border-gray-200 shadow-sm p-6': {},
          },
          '.card-lg': {
            '@apply bg-white rounded-xl border border-gray-200 shadow-lg p-8': {},
          },
          '.badge': {
            '@apply inline-block px-3 py-1 rounded-full text-sm font-medium': {},
          },
          '.badge-success': {
            '@apply bg-green-100 text-green-800': {},
          },
          '.badge-danger': {
            '@apply bg-red-100 text-red-800': {},
          },
          '.badge-warning': {
            '@apply bg-yellow-100 text-yellow-800': {},
          },
        })
      }
    }
  ],
};
