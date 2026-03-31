import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas:          '#0A0A0A',
        card:            '#141414',
        'card-2':        '#1E1E1E',
        accent:          '#C8A84B',
        'accent-muted':  'rgba(200,168,75,0.15)',
        ink:             '#FFFFFF',
        'ink-2':         '#A0A0A0',
        'ink-3':         '#606060',
        rim:             '#2A2A2A',
        success:         '#22C55E',
        warning:         '#F59E0B',
        danger:          '#EF4444',
        info:            '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
    },
  },
  plugins: [],
}

export default config
