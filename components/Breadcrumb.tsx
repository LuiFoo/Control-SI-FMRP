'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export default function Breadcrumb() {
  const pathname = usePathname();

  // Mapear rotas para labels
  const routeLabels: { [key: string]: string } = {
    '/estoque': 'Estoque',
    '/estoque/entrada': 'Entrada',
    '/estoque/saida': 'Saída',
    '/estoque/lista': 'Lista',
    '/estoque/historico': 'Histórico',
    '/estoque/relatorios': 'Relatórios',
    '/estoque/verificacao': 'Verificação',
    '/estoque/verificacao/iniciar': 'Iniciar Verificação',
    '/estoque/verificacao/resumo': 'Resumo',
    '/estoque/verificacao/historico': 'Histórico de Revisões',
    '/estoque/verificacao/visualizar': 'Visualizar Revisão',
  };

  // Construir breadcrumbs baseado no pathname
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];

    // Sempre adicionar página inicial
    breadcrumbs.push({ label: 'Início', href: '/' });

    if (pathname === '/estoque') {
      breadcrumbs.push({ label: 'Estoque', href: '/estoque' });
    } else if (pathname.startsWith('/estoque/')) {
      breadcrumbs.push({ label: 'Estoque', href: '/estoque' });
      
      // Adicionar "Lista" apenas para resumo (que vem da lista)
      if (pathname === '/estoque/verificacao/resumo') {
        breadcrumbs.push({ label: 'Lista', href: '/estoque/lista' });
      }
      
      // Adicionar "Verificação" antes de todas as sub-rotas de verificação
      if (pathname.startsWith('/estoque/verificacao/') && pathname !== '/estoque/verificacao') {
        breadcrumbs.push({ label: 'Verificação', href: '/estoque/verificacao' });
      }
      
      const currentLabel = routeLabels[pathname];
      if (currentLabel && pathname !== '/estoque') {
        breadcrumbs.push({ label: currentLabel, href: pathname });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={item.href} className="flex items-center">
              {index > 0 && (
                <svg
                  className="w-4 h-4 text-gray-400 mx-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isLast ? (
                <span className="text-gray-900 font-semibold">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-[#09624b] hover:text-[#0a7a5f] font-medium transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}


