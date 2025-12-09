'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken, verifyEditarEstoquePermission } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

export default function VerificacaoPage() {
  const router = useRouter();
  const [revisoes, setRevisoes] = useState<Revisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItens, setTotalItens] = useState(0);
  const [hasEditarEstoque, setHasEditarEstoque] = useState(false);

  useEffect(() => {
    carregarDados();
    verificarPermissao();
  }, []);

  const verificarPermissao = async () => {
    const hasPermission = await verifyEditarEstoquePermission();
    setHasEditarEstoque(hasPermission);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = getToken();
      
      const [revisoesRes, itensRes] = await Promise.all([
        fetch('/api/estoque/revisoes', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/estoque', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (revisoesRes.ok) {
        const data = await revisoesRes.json();
        setRevisoes(data.revisoes || []);
      }

      if (itensRes.ok) {
        const data = await itensRes.json();
        setTotalItens(data.itens?.length || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstatisticas = (revisao: Revisao) => {
    const certos = revisao.itens.filter(i => i.status === 'certo').length;
    const errados = revisao.itens.filter(i => i.status === 'errado').length;
    return { certos, errados, total: revisao.itens.length };
  };

  const calcularEstatisticasGerais = () => {
    if (revisoes.length === 0) {
      return {
        totalRevisoes: 0,
        totalItensConferidos: 0,
        totalCertos: 0,
        totalErrados: 0,
        taxaAcerto: 0,
        ultimaRevisao: null,
      };
    }

    let totalItensConferidos = 0;
    let totalCertos = 0;
    let totalErrados = 0;
    let ultimaRevisao = revisoes[0];

    revisoes.forEach((revisao) => {
      const stats = getEstatisticas(revisao);
      totalItensConferidos += stats.total;
      totalCertos += stats.certos;
      totalErrados += stats.errados;
      
      const dataRevisao = new Date(revisao.data_fim);
      const dataUltima = new Date(ultimaRevisao.data_fim);
      if (dataRevisao > dataUltima) {
        ultimaRevisao = revisao;
      }
    });

    const taxaAcerto = totalItensConferidos > 0 
      ? Math.round((totalCertos / totalItensConferidos) * 100) 
      : 0;

    return {
      totalRevisoes: revisoes.length,
      totalItensConferidos,
      totalCertos,
      totalErrados,
      taxaAcerto,
      ultimaRevisao,
    };
  };

  const mesNome = (mes: number) => {
    return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mes - 1];
  };

  const stats = calcularEstatisticasGerais();
  const revisoesRecentes = revisoes.slice(0, 5);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Verificação de Estoque</h1>
            <p className="text-sm text-gray-500">Acompanhe as revisões e realize novas verificações de estoque</p>
          </div>

          {/* Botão para Iniciar Verificação */}
          {hasEditarEstoque && (
            <div className="mb-6">
              <Link
                href="/estoque/verificacao/iniciar"
                className="inline-flex items-center px-6 py-3 bg-[#09624b] text-white rounded-lg hover:bg-[#0a7a5f] transition-colors font-medium text-base"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Iniciar Nova Verificação
              </Link>
            </div>
          )}

          {/* Analytics Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-1">Total de Revisões</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalRevisoes}</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-6">
              <p className="text-sm text-green-700 mb-1">Itens Certos</p>
              <p className="text-3xl font-bold text-green-800">{stats.totalCertos}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-6">
              <p className="text-sm text-red-700 mb-1">Itens com Diferença</p>
              <p className="text-3xl font-bold text-red-800">{stats.totalErrados}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <p className="text-sm text-blue-700 mb-1">Taxa de Acerto</p>
              <p className="text-3xl font-bold text-blue-800">{stats.taxaAcerto}%</p>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-1">Total de Itens no Estoque</p>
              <p className="text-2xl font-bold text-gray-900">{totalItens}</p>
            </div>
            {stats.ultimaRevisao && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-600 mb-1">Última Revisão</p>
                <p className="text-lg font-semibold text-gray-900">
                  {mesNome(stats.ultimaRevisao.mes)} / {stats.ultimaRevisao.ano}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(stats.ultimaRevisao.data_fim).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          {/* Histórico Recente */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Histórico de Revisões</h2>
              <Link
                href="/estoque/verificacao/historico"
                className="text-sm text-[#09624b] hover:text-[#0a7a5f] font-medium"
              >
                Ver todas →
              </Link>
            </div>

            {revisoesRecentes.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>Nenhuma revisão encontrada.</p>
                <p className="text-sm mt-2">Inicie uma nova verificação para começar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mês/Ano</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Certos</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Com Diferença</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Conferidos</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {revisoesRecentes.map((revisao) => {
                      const revisaoStats = getEstatisticas(revisao);
                      return (
                        <tr key={revisao._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {mesNome(revisao.mes)} / {revisao.ano}
                          </td>
                          <td className="px-6 py-4 text-sm text-green-700 font-medium">{revisaoStats.certos}</td>
                          <td className="px-6 py-4 text-sm text-red-700 font-medium">{revisaoStats.errados}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{revisaoStats.total}</td>
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
      </div>
    </ProtectedRoute>
  );
}
