/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        canvas:  '#0F0F11',
        card:    '#18181B',

        // Accents
        accent:  '#FF3D5A',
        'accent-muted': 'rgba(255,61,90,0.15)',
        secondary: '#7B61FF',
        'secondary-muted': 'rgba(123,97,255,0.15)',

        // Text
        ink:    '#FFFFFF',
        'ink-2': '#A1A1AA',

        // Divider / border
        rim:    '#27272A',

        // Status
        success: '#22C55E',
        warning: '#F59E0B',
        danger:  '#EF4444',
        info:    '#3B82F6',
      },
      fontFamily: {
        sans: ['System'],
      },
      fontSize: {
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '18px' }],
        base:  ['15px', { lineHeight: '22px' }],
        lg:    ['17px', { lineHeight: '24px' }],
        xl:    ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
      },
      borderRadius: {
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '20px',
        full: '9999px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
      },
    },
  },
  plugins: [],
}
