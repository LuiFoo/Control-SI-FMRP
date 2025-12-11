'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-client';
import Breadcrumb from '@/components/Breadcrumb';

interface Estatisticas {
  totalEquipamentos: number;
  itensBaixoEstoque: number;
  ultimasEntradas: number;
  ultimasSaidas: number;
}

interface Movimento {
  _id: string;
  tipo: 'entrada' | 'saida';
  itemId: string;
  itemNome: string;
  quantidade: number;
  data: string;
  responsavel?: string;
  setor?: string;
  observacoes?: string;
  numeroChamado?: string;
  usuarioNome?: string;
}

interface ItemEstoque {
  _id: string;
  nome: string;
  quantidade: number;
  quantidade_minima?: number;
}

export default function DashboardEstoque() {
  const router = useRouter();
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalEquipamentos: 0,
    itensBaixoEstoque: 0,
    ultimasEntradas: 0,
    ultimasSaidas: 0,
  });
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [itensBaixoEstoque, setItensBaixoEstoque] = useState<ItemEstoque[]>([]);
  const [itensZerados, setItensZerados] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = getToken();
      
      // Carregar estatísticas e movimentos
      const [itensRes, movimentosRes] = await Promise.allSettled([
        fetch('/api/estoque', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/estoque/movimentos', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (itensRes.status === 'fulfilled' && itensRes.value.ok) {
        const data = await itensRes.value.json();
        const itens: ItemEstoque[] = data.itens || [];
        
        // Calcular estatísticas
        const totalItens = itens.length; // Contar número de itens únicos, não somar quantidades
        const baixoEstoque = itens.filter((item: ItemEstoque) => 
          item.quantidade_minima !== undefined && 
          item.quantidade_minima !== null && 
          item.quantidade <= item.quantidade_minima
        );
        const zerados = itens.filter((item: ItemEstoque) => item.quantidade === 0);
        
        setEstatisticas({
          totalEquipamentos: totalItens,
          itensBaixoEstoque: baixoEstoque.length,
          ultimasEntradas: 0, // Será calculado com movimentos
          ultimasSaidas: 0,
        });
        
        setItensBaixoEstoque(baixoEstoque);
        setItensZerados(zerados);
      }

      if (movimentosRes.status === 'fulfilled' && movimentosRes.value.ok) {
        const data = await movimentosRes.value.json();
        const movs: Movimento[] = data.movimentos || [];
        setMovimentos(movs.slice(0, 10)); // Últimos 10
        
        // Calcular entradas/saídas recentes (últimos 7 dias)
        const agora = new Date();
        const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const entradas = movs.filter(m => {
          if (m.tipo !== 'entrada') return false;
          try {
            const dataMov = new Date(m.data);
            return !isNaN(dataMov.getTime()) && dataMov >= seteDiasAtras;
          } catch {
            return false;
          }
        }).length;
        
        const saidas = movs.filter(m => {
          if (m.tipo !== 'saida') return false;
          try {
            const dataMov = new Date(m.data);
            return !isNaN(dataMov.getTime()) && dataMov >= seteDiasAtras;
          } catch {
            return false;
          }
        }).length;
        
        setEstatisticas(prev => ({
          ...prev,
          ultimasEntradas: entradas,
          ultimasSaidas: saidas,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/estoque/lista?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#09624b] border-t-transparent mx-auto"></div>
          <p className="mt-6 text-gray-600 text-lg">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <Breadcrumb />
        
        {/* Header Section */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard de Estoque</h1>
            <p className="text-sm text-gray-500">Visão geral e controle do seu inventário</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/estoque/verificacao"
              className="px-4 py-2 bg-[#09624b] text-white rounded-md text-sm font-medium hover:bg-[#0a7a5f] transition-colors"
            >
              Verificação
            </Link>
            <Link
              href="/estoque/relatorios"
              className="px-4 py-2 bg-[#09624b] text-white rounded-md text-sm font-medium hover:bg-[#0a7a5f] transition-colors"
            >
              Relatórios
            </Link>
          </div>
        </div>

        {/* Busca Global */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar equipamentos, códigos, categorias..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] bg-white"
            />
          </form>
        </div>

        {/* Alertas */}
        {(itensBaixoEstoque.length > 0 || itensZerados.length > 0) && (
          <div className="mb-6 space-y-3">
            {itensZerados.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-red-800 font-medium text-sm">
                      {itensZerados.length} {itensZerados.length === 1 ? 'item está' : 'itens estão'} com estoque zerado!
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {itensBaixoEstoque.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-yellow-800 font-medium text-sm">
                        {itensBaixoEstoque.length} {itensBaixoEstoque.length === 1 ? 'item com' : 'itens com'} estoque baixo
                      </p>
                    </div>
                  </div>
                  <Link 
                    href="/estoque/lista?filter=baixo" 
                    className="ml-4 px-3 py-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-xs font-medium"
                  >
                    Ver itens
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`bg-white rounded-lg border p-5 ${
            estatisticas.itensBaixoEstoque > 0 ? 'border-yellow-300' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 uppercase">Total de Equipamentos</h3>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{estatisticas.totalEquipamentos}</p>
            <p className="text-xs text-gray-500 mt-1">itens em estoque</p>
          </div>

          <div className={`bg-white rounded-lg border p-5 ${
            estatisticas.itensBaixoEstoque > 0 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 uppercase">Baixo Estoque</h3>
              <svg className={`w-5 h-5 ${
                estatisticas.itensBaixoEstoque > 0 ? 'text-yellow-600' : 'text-gray-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${
              estatisticas.itensBaixoEstoque > 0 ? 'text-yellow-700' : 'text-gray-900'
            }`}>
              {estatisticas.itensBaixoEstoque}
            </p>
            <p className="text-xs text-gray-500 mt-1">requerem atenção</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 uppercase">Últimas Entradas</h3>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{estatisticas.ultimasEntradas}</p>
            <p className="text-xs text-gray-500 mt-1">últimos 7 dias</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 uppercase">Últimas Saídas</h3>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{estatisticas.ultimasSaidas}</p>
            <p className="text-xs text-gray-500 mt-1">últimos 7 dias</p>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/estoque/entrada" className="group">
              <div className="bg-[#09624b] text-white rounded-lg p-4 hover:bg-[#0a7a5f] transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <h3 className="text-sm font-semibold">Nova Entrada</h3>
                </div>
                <p className="text-xs opacity-90">Registrar equipamentos</p>
              </div>
            </Link>
            
            <Link href="/estoque/saida" className="group">
              <div className="bg-white border border-[#09624b] text-[#09624b] rounded-lg p-4 hover:bg-[#09624b] hover:text-white transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <h3 className="text-sm font-semibold">Registrar Saída</h3>
                </div>
                <p className="text-xs opacity-70">Retirar equipamentos</p>
              </div>
            </Link>
            
            <Link href="/estoque/lista" className="group">
              <div className="bg-white border border-gray-300 text-gray-700 rounded-lg p-4 hover:border-[#09624b] hover:text-[#09624b] transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold">Consultar Estoque</h3>
                </div>
                <p className="text-xs opacity-70">Ver todos os itens</p>
              </div>
            </Link>
            
            <Link href="/estoque/historico" className="group">
              <div className="bg-white border border-gray-300 text-gray-700 rounded-lg p-4 hover:border-[#09624b] hover:text-[#09624b] transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold">Histórico Completo</h3>
                </div>
                <p className="text-xs opacity-70">Ver movimentações</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Tabela de Últimos Movimentos */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Últimos Movimentos</h2>
              <Link 
                href="/estoque/historico" 
                className="text-[#09624b] hover:text-[#0a7a5f] text-xs font-medium flex items-center gap-1"
              >
                Ver todos
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Equipamento</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Quantidade</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Responsável / Setor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nº Chamado</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Observações</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {movimentos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500 text-sm">
                        Nenhum movimento registrado ainda
                      </td>
                    </tr>
                  ) : (
                    movimentos.map((mov) => (
                      <tr key={mov._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            mov.tipo === 'entrada' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{mov.itemNome}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{mov.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(mov.data).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {mov.responsavel || mov.setor || '—'}
                          {mov.responsavel && mov.setor && ` — ${mov.setor}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{mov.numeroChamado || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {mov.observacoes || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {mov.usuarioNome ? mov.usuarioNome.split('@')[0] : '—'}
                        </td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
