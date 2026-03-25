// app/page.tsx
import { Suspense } from 'react';
import Header from '@/components/Header';
import DashboardClient from '@/components/DashboardClient';

export const revalidate = 3600; // ISR: revalidate every hour

export default function Home() {
  return (
    <main className="min-h-screen court-lines">
      <Header />
      <Suspense fallback={null}>
        <DashboardClient />
      </Suspense>
    </main>
  );
}
