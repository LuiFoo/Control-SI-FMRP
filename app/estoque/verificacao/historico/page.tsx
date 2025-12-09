'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';

interface Revisao {
  _id: string;
  mes: number;
  ano: number;
  data_fim: string;
  usuario: string;
  status: string;
  itens: Array<{
    status: 'certo' | 'errado';
  }>;
}

export default function HistoricoPage() {
  const router = useRouter();
  const [revisoes, setRevisoes] = useState<Revisao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarRevisoes();
  }, []);

  const carregarRevisoes = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/estoque/revisoes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRevisoes(data.revisoes || []);
      }
    } catch (error) {
      console.error('Erro ao carregar revisões:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstatisticas = (revisao: Revisao) => {
    const certos = revisao.itens.filter(i => i.status === 'certo').length;
    const errados = revisao.itens.filter(i => i.status === 'errado').length;
    return { certos, errados, total: revisao.itens.length };
  };

  const mesNome = (mes: number) => {
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][mes - 1];
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Carregando...</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Histórico de Revisões</h1>
            <p className="text-sm text-gray-500">Todas as revisões de estoque realizadas</p>
          </div>

          {revisoes.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Nenhuma revisão encontrada.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mês/Ano</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Certos</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Errados</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Conferidos</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {revisoes.map((revisao) => {
                    const stats = getEstatisticas(revisao);
                    return (
                      <tr key={revisao._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {mesNome(revisao.mes)} / {revisao.ano}
                        </td>
                        <td className="px-6 py-4 text-sm text-green-700 font-medium">{stats.certos}</td>
                        <td className="px-6 py-4 text-sm text-red-700 font-medium">{stats.errados}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{stats.total}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(revisao.data_fim).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => router.push(`/estoque/verificacao/visualizar?id=${revisao._id}`)}
                            className="text-[#09624b] hover:text-[#0a7a5f] font-medium text-sm"
                          >
                            👁 Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}



