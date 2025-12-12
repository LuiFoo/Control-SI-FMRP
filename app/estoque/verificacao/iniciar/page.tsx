'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';

interface ItemEstoque {
  _id: string;
  nome: string;
  categoria?: string;
  quantidade: number;
  unidade?: string;
}

interface ItemRevisao {
  item_id: string;
  nome_item: string;
  sistema: number;
  contado: number | null;
  status: 'certo' | 'errado' | null;
}

export default function IniciarVerificacaoPage() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemAtualIndex, setItemAtualIndex] = useState(0);
  const [quantidadeContada, setQuantidadeContada] = useState('');
  const [revisao, setRevisao] = useState<ItemRevisao[]>([]);
  const revisaoRef = useRef<ItemRevisao[]>([]);
  const [dataInicio] = useState(new Date());

  useEffect(() => {
    carregarItens();
  }, []);

  useEffect(() => {
    // Atualizar quantidade contada quando mudar de item
    const itemRevisaoAtual = revisao[itemAtualIndex];
    if (itemRevisaoAtual && itemRevisaoAtual.contado !== null) {
      setQuantidadeContada(itemRevisaoAtual.contado.toString());
    } else {
      setQuantidadeContada('');
    }
  }, [itemAtualIndex, revisao]);

  const carregarItens = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch('/api/estoque', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const itensOrdenados = (data.itens || []).sort((a: ItemEstoque, b: ItemEstoque) => 
          a.nome.localeCompare(b.nome)
        );
        setItens(itensOrdenados);
        // Inicializar revisão com todos os itens
        const revisaoInicial = itensOrdenados.map((item: ItemEstoque) => ({
          item_id: item._id,
          nome_item: item.nome,
          sistema: item.quantidade,
          contado: null,
          status: null,
        }));
        setRevisao(revisaoInicial);
        revisaoRef.current = revisaoInicial;
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const itemAtual = itens[itemAtualIndex];
  const itemRevisaoAtual = revisao[itemAtualIndex];
  const progresso = ((itemAtualIndex + 1) / itens.length) * 100;
  const itensConcluidos = revisao.filter(r => r.status !== null).length;

  const handleQuantidadeChange = (value: string) => {
    setQuantidadeContada(value);
  };

  const handleEstaCerto = () => {
    const contado = parseInt(quantidadeContada, 10);
    if (isNaN(contado)) {
      alert('Por favor, digite uma quantidade válida.');
      return;
    }
    if (contado === itemAtual.quantidade) {
      const novaRevisao = [...revisao];
      const itemAtualizado = {
        ...itemRevisaoAtual,
        contado: contado,
        status: 'certo' as const,
      };
      novaRevisao[itemAtualIndex] = itemAtualizado;
      setRevisao(novaRevisao);
      revisaoRef.current = novaRevisao;
      // Usar requestAnimationFrame ao invés de setTimeout para melhor performance
      requestAnimationFrame(() => {
        avancarItem();
      });
    } else {
      alert('A quantidade contada deve ser igual à quantidade no sistema para marcar como "Está certo".');
    }
  };

  const handleEstaErrado = () => {
    const contado = parseInt(quantidadeContada, 10);
    if (isNaN(contado)) {
      alert('Por favor, digite uma quantidade válida.');
      return;
    }
    const novaRevisao = [...revisao];
    const itemAtualizado = {
      ...itemRevisaoAtual,
      contado: contado,
      status: 'errado' as const,
    };
      novaRevisao[itemAtualIndex] = itemAtualizado;
      setRevisao(novaRevisao);
      revisaoRef.current = novaRevisao;
      // Usar requestAnimationFrame ao invés de setTimeout para melhor performance
      requestAnimationFrame(() => {
        avancarItem();
      });
  };

  const avancarItem = () => {
    setQuantidadeContada('');
    if (itemAtualIndex < itens.length - 1) {
      setItemAtualIndex(itemAtualIndex + 1);
    } else {
      // Finalizou todos os itens - usar requestAnimationFrame para garantir que o estado foi atualizado
      requestAnimationFrame(() => {
        finalizarRevisao();
      });
    }
  };

  const voltarItem = () => {
    if (itemAtualIndex > 0) {
      setItemAtualIndex(itemAtualIndex - 1);
      const itemAnterior = revisao[itemAtualIndex - 1];
      setQuantidadeContada(itemAnterior.contado?.toString() || '');
    }
  };

  const finalizarRevisao = async () => {
    try {
      const token = getToken();
      const agora = new Date();
      const mes = agora.getMonth() + 1;
      const ano = agora.getFullYear();

      // Usar o ref para garantir que temos o estado mais recente
      const revisaoAtual = revisaoRef.current.length > 0 ? revisaoRef.current : revisao;
      
      // Filtrar apenas itens que foram revisados (têm status definido)
      const itensRevisados = revisaoAtual.filter(item => item.status !== null && item.status !== undefined);
      
      // Validar se há itens revisados
      if (itensRevisados.length === 0) {
        alert('Não é possível finalizar uma revisão sem itens revisados. Por favor, revise pelo menos um item.');
        return;
      }
      
      const revisaoCompleta = {
        mes,
        ano,
        data_inicio: dataInicio.toISOString(),
        data_fim: agora.toISOString(),
        status: 'finalizada',
        itens: itensRevisados,
      };

      const response = await fetch('/api/estoque/revisoes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(revisaoCompleta),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/estoque/verificacao/resumo?id=${data.revisaoId}`);
      } else {
        alert('Erro ao salvar revisão');
      }
    } catch (error) {
      console.error('Erro ao finalizar revisão:', error);
      alert('Erro ao finalizar revisão');
    }
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

  if (itens.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-4">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Breadcrumb />
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Nenhum item encontrado no estoque.</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-4">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Breadcrumb />
          
          {/* Cabeçalho */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verificação de Item por Item</h1>
            <p className="text-sm text-gray-500">Item {itemAtualIndex + 1} de {itens.length}</p>
          </div>

          {/* Barra de Progresso */}
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progresso</span>
              <span className="text-sm text-gray-600">{itensConcluidos} de {itens.length} concluídos</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#09624b] h-3 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>

          {/* Card do Item */}
          {itemAtual && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{itemAtual.nome}</h2>
                {itemAtual.categoria && (
                  <p className="text-sm text-gray-600 mb-4">Categoria: {itemAtual.categoria}</p>
                )}
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Quantidade no Sistema</p>
                <p className="text-2xl font-bold text-gray-900">
                  {itemAtual.quantidade} {itemAtual.unidade || 'un'}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade Contada Fisicamente
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantidadeContada}
                  onChange={(e) => handleQuantidadeChange(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09624b]"
                  placeholder="Digite a quantidade contada..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleEstaCerto}
                  disabled={!quantidadeContada || parseInt(quantidadeContada) !== itemAtual.quantidade}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <span>✓</span> Está certo
                </button>
                <button
                  onClick={handleEstaErrado}
                  disabled={!quantidadeContada}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <span>✖</span> Está errado
                </button>
              </div>
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="flex justify-between">
            <button
              onClick={voltarItem}
              disabled={itemAtualIndex === 0}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => {
                if (itemAtualIndex < itens.length - 1) {
                  setItemAtualIndex(itemAtualIndex + 1);
                  setQuantidadeContada('');
                }
              }}
              disabled={itemAtualIndex >= itens.length - 1}
              className="px-6 py-2 bg-[#09624b] text-white rounded-lg hover:bg-[#0a7a5f] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Próximo →
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

