'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';

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

export default function HistoricoPage() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [filtroData, setFiltroData] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos');

  useEffect(() => {
    carregarMovimentos();
  }, []);

  const carregarMovimentos = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch('/api/estoque/movimentos', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMovimentos(data.movimentos || []);
      }
    } catch (error) {
      console.error('Erro ao carregar movimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const movimentosFiltrados = movimentos.filter(mov => {
    // Filtro de tipo
    if (filtroTipo !== 'todos' && mov.tipo !== filtroTipo) {
      return false;
    }

    // Filtro de data
    if (filtroData !== 'todos') {
      const agora = new Date();
      const dataMov = new Date(mov.data);
      const diffMs = agora.getTime() - dataMov.getTime();
      const diffDias = diffMs / (1000 * 60 * 60 * 24);

      if (filtroData === 'hoje' && diffDias >= 1) return false;
      if (filtroData === 'semana' && diffDias >= 7) return false;
      if (filtroData === 'mes' && diffDias >= 30) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando histórico...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-4">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumb />
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Histórico Completo</h1>
            <p className="text-sm text-gray-500">Todas as entradas e saídas registradas</p>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09624b]"
                >
                  <option value="todos">Todos</option>
                  <option value="entrada">Entradas</option>
                  <option value="saida">Saídas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <select
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value as 'todos' | 'hoje' | 'semana' | 'mes')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09624b]"
                >
                  <option value="todos">Todos</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Última semana</option>
                  <option value="mes">Último mês</option>
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data/Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Equipamento</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Responsável / Setor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nº Chamado</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Observações</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movimentosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        Nenhum movimento encontrado
                      </td>
                    </tr>
                  ) : (
                    movimentosFiltrados.map((mov) => (
                      <tr key={mov._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(mov.data).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            mov.tipo === 'entrada' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{mov.itemNome}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{mov.quantidade}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {mov.responsavel && mov.setor 
                            ? `${mov.responsavel} — ${mov.setor}`
                            : mov.responsavel || mov.setor || '-'
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{mov.numeroChamado || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{mov.observacoes || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{mov.usuarioNome || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Total: {movimentosFiltrados.length} {movimentosFiltrados.length === 1 ? 'movimento' : 'movimentos'}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

