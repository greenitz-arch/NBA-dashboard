// app/layout.tsx
import type { Metadata } from 'next';
import { Barlow_Condensed, DM_Sans, DM_Mono } from 'next/font/google';
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
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="bg-court-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
