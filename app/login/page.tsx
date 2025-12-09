'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateEmail } from "@/lib/auth-client";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validar email @fmrp.usp.br
    if (!validateEmail(email)) {
      setError('Email deve ser do domínio @fmrp.usp.br');
      setLoading(false);
      return;
    }

    try {
      setSlowConnection(false);
      
      // Avisar se estiver demorando muito (após 10 segundos)
      const slowWarning = setTimeout(() => {
        if (loading) {
          setSlowConnection(true);
        }
      }, 10000);
      
      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 45000); // 45 segundos de timeout (mais que o tempo máximo de tentativas)
      
      let response;
      try {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: email, password }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        clearTimeout(slowWarning);
        setSlowConnection(false);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        clearTimeout(slowWarning);
        setSlowConnection(false);
        if (fetchError.name === 'AbortError') {
          setError('Timeout: A conexão está demorando muito. Verifique sua conexão de rede e tente novamente.');
          setLoading(false);
          return;
        }
        throw fetchError;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        setError('Erro ao processar resposta do servidor');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        // Tratar diferentes tipos de erro
        if (response.status === 403) {
          // Acesso negado - não é admin
          setError('Acesso negado. Apenas administradores podem acessar o sistema. Verifique se seu usuário tem permissão "admin" no banco de dados.');
        } else if (response.status === 503) {
          // Erro de conexão com banco de dados
          const errorMsg = data.error || 'Erro ao conectar com o banco de dados';
          if (errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
            setError('Erro de conexão SSL/TLS. Isso pode acontecer em conexões WiFi. Tente: 1) Conectar via cabo de rede, 2) Aguardar alguns segundos e tentar novamente, 3) Verificar sua conexão de internet.');
          } else if (errorMsg.includes('Timeout')) {
            setError('Timeout na conexão. WiFi pode ter latência maior. Tente: 1) Conectar via cabo de rede, 2) Aguardar alguns segundos e tentar novamente.');
          } else {
            setError(errorMsg + ' Tente novamente em alguns segundos.');
          }
        } else if (data.error === 'Credenciais inválidas') {
          setError('Email ou senha incorretos. Verifique suas credenciais.');
        } else {
          setError(data.error || 'Erro ao fazer login. Tente novamente.');
        }
        setLoading(false);
        return;
      }

      // Verificar se o token foi retornado
      if (!data.token) {
        setError('Erro: Token não recebido do servidor');
        setLoading(false);
        return;
      }
      
      // Salvar token no localStorage (para uso no cliente)
      localStorage.setItem('token', data.token);
      
      // Resetar loading
      setLoading(false);
      
      // Redirecionar usando router.push (melhor para Next.js)
      router.push('/');
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Erro ao conectar com o servidor. Verifique sua conexão de internet e tente novamente.');
      setLoading(false);
      setSlowConnection(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #7dc4a8, #09624b)'
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 lg:p-12">
          {/* Foto */}
          <div className="flex justify-center mb-8" style={{ minHeight: '120px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/background.png"
              alt="Foto"
              className="w-auto h-auto max-w-[120px] lg:max-w-[150px] object-contain"
              style={{ 
                height: 'auto', 
                maxHeight: '150px', 
                display: 'block',
                width: 'auto'
              }}
              loading="eager"
              onError={(e) => {
                const img = e.currentTarget;
                img.src = '/background.png?v=' + Date.now();
              }}
            />
          </div>

          {/* Título */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
              Bem-vindo
            </h1>
            <p className="text-gray-500 text-center">
              Faça login para continuar
            </p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
              {error.includes('Email ou senha incorretos') && (
                <div className="mt-2">
                  <Link 
                    href="/cadastro" 
                    className="font-semibold underline hover:text-red-800"
                  >
                    Criar conta agora
                  </Link>
                </div>
              )}
            </div>
          )}

          {slowConnection && !error && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg text-sm">
              ⏳ A conexão está demorando mais que o normal. Isso pode acontecer em WiFi. Aguarde...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-sm font-semibold text-gray-600"
              >
                Email @fmrp.usp.br
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 transition-colors duration-200 group-focus-within:text-[#ac3b30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ac3b30] focus:border-[#ac3b30] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="seu.email@fmrp.usp.br"
                />
              </div>
              <p className="text-xs text-gray-500">Apenas emails @fmrp.usp.br são permitidos</p>
            </div>

            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-sm font-semibold text-gray-600"
              >
                Senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 transition-colors duration-200 group-focus-within:text-[#ac3b30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ac3b30] focus:border-[#ac3b30] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 border-gray-300 rounded focus:ring-2 cursor-pointer"
                  style={{ accentColor: '#ac3b30' }}
                  disabled={loading}
                />
                <span className="ml-3 text-sm text-gray-600 group-hover:text-gray-700 transition-colors">Lembrar-me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3.5 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 mt-6 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: '#09624b' }}
            >
              {loading && (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Conectando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link 
                href="/cadastro" 
                className="font-semibold text-[#09624b] hover:text-[#7dc4a8] transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
