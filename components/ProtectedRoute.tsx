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
          console.log('❌ Sem token');
          if (isMounted) {
            router.push('/login');
          }
          return;
        }

        console.log('🔍 Verificando autenticação...');
        
        // Verificar apenas se o token é válido (qualquer usuário autenticado pode acessar)
        const isValid = await verifyToken();
        
        console.log('📊 Resultado da verificação:', isValid);
        
        if (!isValid) {
          console.log('❌ Token inválido, redirecionando...');
          if (isMounted) {
            // Remover token inválido
            removeToken();
            // Redirecionar para login
            router.push('/login');
          }
          return;
        }

        console.log('✅ Autenticação confirmada, permitindo acesso');
        if (isMounted) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
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

