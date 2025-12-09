'use client';

import { useState, useEffect, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';

interface ItemEstoque {
  _id: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
  unidade: string;
  categoria?: string;
  localizacao?: string;
}

function ListaContent() {
  const searchParams = useSearchParams();
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    if (searchParams) {
      setSearchTerm(searchParams.get('search') || '');
      setFilter(searchParams.get('filter') || 'todos');
    }
  }, [searchParams]);

  useEffect(() => {
    carregarItens();
  }, []);

  const carregarItens = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch('/api/estoque', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setItens(data.itens || []);
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const itensFiltrados = itens.filter(item => {
    // Filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNome = item.nome?.toLowerCase().includes(term);
      const matchDescricao = item.descricao?.toLowerCase().includes(term);
      const matchCategoria = item.categoria?.toLowerCase().includes(term);
      const matchLocalizacao = item.localizacao?.toLowerCase().includes(term);
      
      if (!matchNome && !matchDescricao && !matchCategoria && !matchLocalizacao) {
        return false;
      }
    }

    // Filtro de status
    if (filter === 'baixo') {
      return item.quantidade_minima && item.quantidade <= item.quantidade_minima;
    }
    if (filter === 'zerado') {
      return item.quantidade === 0;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Breadcrumb />
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Estoque Atual</h1>
            <p className="text-sm text-gray-500">Lista completa de equipamentos em estoque</p>
          </div>
          <Link
            href="/estoque/verificacao"
            className="px-4 py-2 bg-[#09624b] text-white rounded-lg hover:bg-[#0a7a5f] transition-colors font-medium"
          >
            Verificação de Item por Item
          </Link>
        </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, descrição, categoria, local..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09624b]"
                />
              </div>
              <div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09624b]"
                >
                  <option value="todos">Todos</option>
                  <option value="baixo">Baixo Estoque</option>
                  <option value="zerado">Estoque Zerado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unidade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Categoria</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Localização</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Nenhum item encontrado
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item) => {
                      const isBaixoEstoque = item.quantidade_minima && item.quantidade <= item.quantidade_minima;
                      const isZerado = item.quantidade === 0;
                      
                      return (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{item.nome}</div>
                            {item.descricao && (
                              <div className="text-sm text-gray-500">{item.descricao}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.quantidade}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.unidade}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.categoria || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.localizacao || '-'}</td>
                          <td className="px-6 py-4">
                            {isZerado ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                Zerado
                              </span>
                            ) : isBaixoEstoque ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                Baixo
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Total: {itensFiltrados.length} {itensFiltrados.length === 1 ? 'item' : 'itens'}
          </div>
        </div>
      </div>
  );
}

export default function ListaPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      }>
        <ListaContent />
      </Suspense>
    </ProtectedRoute>
  );
}

