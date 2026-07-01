import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ENOS Dashboard — Every Nation',
  description: 'Admin configuration dashboard for the Every Nation Discord server bot.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
