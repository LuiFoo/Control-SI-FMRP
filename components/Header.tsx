'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getToken, removeToken } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

interface UserData {
  id: string;
  username: string;
  permissao: string;
  inicial?: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [textoAnimado, setTextoAnimado] = useState('');
  const [mostrarCursor, setMostrarCursor] = useState(true);

  // Carregar dados do usuário
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };

    loadUser();
  }, []);

  // Animação de digitação
  useEffect(() => {
    const textoCompleto = 'Control SI-FMRP';
    let index = 0;
    let isDeleting = false;
    
    const typeWriter = () => {
      if (!isDeleting && index < textoCompleto.length) {
        // Digitando
        setTextoAnimado(textoCompleto.substring(0, index + 1));
        index++;
        setTimeout(typeWriter, 100);
      } else if (isDeleting && index > 0) {
        // Apagando
        index--;
        setTextoAnimado(textoCompleto.substring(0, index));
        setTimeout(typeWriter, 50);
      } else if (!isDeleting && index === textoCompleto.length) {
        // Espera antes de apagar
        setTimeout(() => {
          isDeleting = true;
          typeWriter();
        }, 2000);
      } else if (isDeleting && index === 0) {
        // Espera antes de digitar novamente
        isDeleting = false;
        setTimeout(typeWriter, 500);
      }
    };
    
    typeWriter();
    
    // Animação do cursor piscando
    const cursorInterval = setInterval(() => {
      setMostrarCursor(prev => !prev);
    }, 530);
    
    return () => clearInterval(cursorInterval);
  }, []);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleLogout = async () => {
    try {
      const token = getToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
      removeToken();
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      removeToken();
      router.push('/login');
    }
  };

  // Não mostrar header nas páginas de login e cadastro
  if (pathname === '/login' || pathname === '/cadastro') {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <img
              src="/background.png"
              alt="SI-FMRP Logo"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                const img = e.currentTarget;
                img.src = '/background.png?v=' + Date.now();
              }}
            />
            <span className="text-lg font-semibold text-gray-900 hidden sm:block">
              <span className="inline-block">
                {textoAnimado}
                <span className={`inline-block w-0.5 h-4 bg-[#09624b] ml-1 align-middle transition-opacity duration-300 ${mostrarCursor ? 'opacity-100' : 'opacity-0'}`}></span>
              </span>
            </span>
          </Link>

          {/* Menu do usuário */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.username?.split('@')[0] || 'Usuário'}
                </p>
              </div>
              <div className="h-9 w-9 rounded-full bg-[#09624b] flex items-center justify-center text-white text-sm font-medium">
                {user?.inicial || user?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <svg 
                className={`w-4 h-4 text-gray-600 transition-transform ${showMenu ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.username || 'Usuário'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

