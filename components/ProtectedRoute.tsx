'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyToken, getToken, removeToken } from '@/lib/auth-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const token = getToken();
        
        if (!token) {
          if (isMounted) {
            router.push('/login');
          }
          return;
        }
        
        // Verificar se o token é válido E se o usuário tem permissão de login
        // O verifyToken() já verifica a permissão de login e desloga automaticamente se login !== true
        // Ele também redireciona automaticamente, então não precisamos fazer nada aqui se retornar false
        const isValid = await verifyToken();
        
        if (!isValid) {
          // verifyToken() já removeu o token e redirecionou, apenas retornar
          // Não fazer nada adicional para evitar redirecionamentos duplos
          return;
        }

        if (isMounted) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        if (isMounted) {
          removeToken();
          router.push('/login');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

