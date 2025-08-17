const preset = require('../../packages/ui/tailwind.preset.js');

module.exports = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}',
     '../../packages/core/src/**/*.{ts,tsx}',
  ],
};
