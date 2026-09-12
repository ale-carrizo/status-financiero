import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Status Financiero',
  description: 'Rendición de gastos — empresa vs personal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
