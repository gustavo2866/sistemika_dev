const preset = require('../../packages/ui/tailwind.preset.js');

module.exports = {
  presets: [preset],
  theme: {
    extend: {
      colors: {
        primary: 'oklch(0.6 0.2 30)', // rojo solo para app2
      },
    },
  },
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}',
  ],
};
