import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'RGS Client Portal',
  description: 'Projects, documents, inspections, approvals and handover in one controlled workspace.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#e8ebf0', color: '#1a2740' }}>{children}</body>
    </html>
  );
}
