module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        modalIn: {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'modal-in': 'modalIn 220ms cubic-bezier(.2,.9,.25,1) forwards',
      },
    },
  },
  plugins: [],
  corePlugins: {},
}
