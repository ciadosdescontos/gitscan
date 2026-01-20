import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Brutalista: Cores de severidade com alto contraste
        severity: {
          critical: '#ff0000',
          high: '#ffff00',
          medium: '#0055ff',
          low: '#888888',
          info: '#000000',
        },
        // Brutalista: Cores de destaque
        brutal: {
          yellow: 'hsl(var(--brutal-yellow))',
          red: 'hsl(var(--brutal-red))',
          blue: 'hsl(var(--brutal-blue))',
          green: 'hsl(var(--brutal-green))',
        },
      },
      // Brutalista: Sem bordas arredondadas
      borderRadius: {
        lg: '0px',
        md: '0px',
        sm: '0px',
        DEFAULT: '0px',
      },
      // Brutalista: Bordas grossas
      borderWidth: {
        DEFAULT: '2px',
        '0': '0px',
        '1': '1px',
        '2': '2px',
        '3': '3px',
        '4': '4px',
        '6': '6px',
        '8': '8px',
      },
      // Brutalista: Tipografia forte
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'display': ['5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '900' }],
        'display-sm': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '900' }],
      },
      // Brutalista: Sombras offset (sem blur)
      boxShadow: {
        'brutal': '4px 4px 0px 0px hsl(var(--foreground))',
        'brutal-lg': '8px 8px 0px 0px hsl(var(--foreground))',
        'brutal-xl': '12px 12px 0px 0px hsl(var(--foreground))',
        'brutal-yellow': '4px 4px 0px 0px hsl(var(--brutal-yellow))',
        'brutal-red': '4px 4px 0px 0px hsl(var(--brutal-red))',
        'brutal-blue': '4px 4px 0px 0px hsl(var(--brutal-blue))',
        'none': 'none',
      },
      // Brutalista: Animações sutis
      animation: {
        'brutal-shake': 'brutal-shake 0.5s ease-in-out',
        'brutal-bounce': 'brutal-bounce 0.3s ease-out',
        'marquee': 'marquee 20s linear infinite',
      },
      keyframes: {
        'brutal-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'brutal-bounce': {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      // Brutalista: Transições rápidas
      transitionDuration: {
        '150': '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
