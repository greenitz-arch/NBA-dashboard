import type { Metadata } from 'next';

// Keeps the private stats page out of search engines.
export const metadata: Metadata = {
  title: 'HQ',
  robots: { index: false, follow: false },
};

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
