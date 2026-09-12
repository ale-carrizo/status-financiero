import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/statements/upload', label: 'Subir resumen' },
  { href: '/history', label: 'Historial' },
  { href: '/projections', label: 'Proyecciones' },
  { href: '/rules', label: 'Reglas' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold">Status Financiero</span>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action="/auth/logout" method="post">
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-800">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
