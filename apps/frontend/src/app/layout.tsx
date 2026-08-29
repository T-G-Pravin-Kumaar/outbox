import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/Providers';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Outbox - ReachInbox Email Scheduler',
  description: 'Production-grade email scheduler service & dashboard at scale',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
