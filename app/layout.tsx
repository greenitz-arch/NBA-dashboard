import type { Metadata } from 'next';
import { Barlow_Condensed, DM_Sans, DM_Mono } from 'next/font/google';
import ThemeProvider from '@/components/ThemeProvider';
import './globals.css';

const displayFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const bodyFont = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Courtside — NBA Player Dashboard',
  description: 'Your personal NBA player stats dashboard. Updated daily after games.',
  openGraph: {
    title: 'Courtside — NBA Player Dashboard',
    description: 'Track your favourite NBA players — daily stats, updated every morning.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('courtside_theme') || 'dark';
              var resolved = saved === 'system'
                ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
                : saved;
              document.documentElement.setAttribute('data-theme', resolved === 'skin' ? 'dark' : resolved);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body style={{ background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
