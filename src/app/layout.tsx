import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Neighbr', template: '%s' },
  description: 'A shared map for local life and civic participation. Demonstration shell with invented data.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0a3a2d' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
