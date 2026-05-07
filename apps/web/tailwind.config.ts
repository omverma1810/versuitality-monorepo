import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Brand
        gold: {
          DEFAULT: '#CBA624',
          50: '#FBF6E0',
          100: '#F6EBB7',
          200: '#EDD773',
          300: '#E2C23E',
          400: '#D4B22D',
          500: '#CBA624',
          600: '#A6861B',
          700: '#7E6614',
          800: '#54440D',
          900: '#2C2406',
        },
        navy: {
          DEFAULT: '#261F53',
          50: '#E8E5F4',
          100: '#C7C0E0',
          200: '#9C90C5',
          300: '#7160AA',
          400: '#4E3F87',
          500: '#3A2F6D',
          600: '#261F53',
          700: '#1D1840',
          800: '#13102C',
          900: '#0A0818',
        },

        // Semantic surfaces (token-driven)
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },

        // Status badges (consistent across screens)
        status: {
          received: '#6B7280',
          production: '#3B82F6',
          trial: '#F59E0B',
          rejected: '#EF4444',
          ready: '#10B981',
          delivered: '#059669',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'gradient-brand':
          'linear-gradient(135deg, #261F53 0%, #3A2F6D 50%, #1D1840 100%)',
        'gradient-gold':
          'linear-gradient(135deg, #CBA624 0%, #E2C23E 50%, #A6861B 100%)',
        'glass-sheen':
          'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(10, 8, 24, 0.45)',
        gold: '0 8px 24px -4px rgba(203, 166, 36, 0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
