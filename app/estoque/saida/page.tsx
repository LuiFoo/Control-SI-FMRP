'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';

interface ItemEstoque {
  _id: string;
  nome: string;
  quantidade: number;
  categoria?: string;
  unidade?: string;
  descricao?: string;
}

export default function SaidaPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [itensFiltrados, setItensFiltrados] = useState<ItemEstoque[]>([]);
  const [itemSelecionado, setItemSelecionado] = useState<ItemEstoque | null>(null);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [numeroChamado, setNumeroChamado] = useState('');
  const [dataHora, setDataHora] = useState(() => {
    const now = new Date();
    // Formato para input datetime-local: YYYY-MM-DDTHH:mm
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [erros, setErros] = useState<{ [key: string]: string }>({});
  const [usuario, setUsuario] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertaEstoqueBaixo, setAlertaEstoqueBaixo] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarUsuario();
    carregarItens();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      filtrarItens();
      setMostrarLista(true);
    } else {
      setItensFiltrados([]);
      setMostrarLista(false);
    }
  }, [searchTerm, itens]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setMostrarLista(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (itemSelecionado && quantidade > 0) {
      const estoqueRestante = itemSelecionado.quantidade - quantidade;
      setAlertaEstoqueBaixo(estoqueRestante < 10 && estoqueRestante >= 0);
    } else {
      setAlertaEstoqueBaixo(false);
    }
  }, [itemSelecionado, quantidade]);

  const carregarUsuario = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/auth/user', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsuario(data.user);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  };

  const carregarItens = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch('/api/estoque', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Filtrar apenas itens com estoque disponível
        const itensComEstoque = (data.itens || []).filter((item: ItemEstoque) => item.quantidade > 0);
        setItens(itensComEstoque);
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtrarItens = () => {
    const term = searchTerm.toLowerCase().trim();
    const filtrados = itens.filter((item) =>
      item.nome.toLowerCase().includes(term)
    );
    setItensFiltrados(filtrados.slice(0, 10));
  };

  const selecionarItem = (item: ItemEstoque) => {
    setItemSelecionado(item);
    setSearchTerm(item.nome);
    setMostrarLista(false);
    setQuantidade(1);
    setErros({});
  };

  const limparSelecao = () => {
    setItemSelecionado(null);
    setSearchTerm('');
    setQuantidade(1);
    setMotivo('');
    setResponsavel('');
    setNumeroChamado('');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setDataHora(`${year}-${month}-${day}T${hours}:${minutes}`);
    setErros({});
    setAlertaEstoqueBaixo(false);
  };

  const validarFormulario = (): boolean => {
    const novosErros: { [key: string]: string } = {};
    
    if (!itemSelecionado) {
      novosErros.item = 'Selecione um item';
    } else {
      if (!quantidade || quantidade <= 0) {
        novosErros.quantidade = 'Quantidade deve ser maior que zero';
      } else if (quantidade > itemSelecionado.quantidade) {
        novosErros.quantidade = `Quantidade indisponível. Estoque atual: ${itemSelecionado.quantidade} ${itemSelecionado.unidade || 'un'}`;
      }
    }
    
    if (!responsavel.trim()) {
      novosErros.responsavel = 'Nome do responsável é obrigatório';
    }
    
    if (!numeroChamado.trim()) {
      novosErros.numeroChamado = 'Número do chamado é obrigatório';
    } else if (!/^\d+$/.test(numeroChamado.trim())) {
      novosErros.numeroChamado = 'Número do chamado deve conter apenas números';
    }
    
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleQuantidadeChange = (value: number) => {
    if (itemSelecionado) {
      if (value > itemSelecionado.quantidade) {
        setErros({ ...erros, quantidade: `Quantidade indisponível. Estoque atual: ${itemSelecionado.quantidade} ${itemSelecionado.unidade || 'un'}` });
      } else {
        setErros({ ...erros, quantidade: '' });
      }
    }
    setQuantidade(value);
  };

  const handleRetiradaRapida = (valor: number) => {
    if (itemSelecionado) {
      const novaQuantidade = Math.min(valor, itemSelecionado.quantidade);
      setQuantidade(novaQuantidade);
      setErros({ ...erros, quantidade: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    try {
      setSubmitting(true);
      const token = getToken();

      const response = await fetch('/api/estoque/movimentos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: 'saida',
          itemId: itemSelecionado!._id,
          quantidade: Number(quantidade),
          responsavel: responsavel.trim(),
          numeroChamado: numeroChamado.trim(),
          observacoes: motivo.trim() || null,
          data: dataHora ? new Date(dataHora).toISOString() : new Date().toISOString(),
        }),
      });

      if (response.ok) {
        alert('Saída registrada com sucesso!');
        limparSelecao();
        await carregarItens();
        router.push('/estoque');
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao registrar saída');
      }
    } catch (error) {
      console.error('Erro ao processar saída:', error);
      alert('Erro ao processar saída');
    } finally {
      setSubmitting(false);
    }
  };

  const dataAtualFormatada = dataHora 
    ? new Date(dataHora).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const estoqueRestante = itemSelecionado 
    ? itemSelecionado.quantidade - quantidade 
    : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-4">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Registrar Saída de Estoque</h1>
            <p className="text-sm text-gray-500">Registre a retirada de itens do estoque</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Busca de Item */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Buscar Item
              </label>
              
              <div className="relative" ref={searchRef}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setItemSelecionado(null);
                  }}
                  onFocus={() => {
                    if (searchTerm.length >= 2) setMostrarLista(true);
                  }}
                  placeholder="Digite pelo menos 2 letras..."
                  className={`w-full px-4 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                    erros.item ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                
                {mostrarLista && itensFiltrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {itensFiltrados.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => selecionarItem(item)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                      >
                        <div className="font-medium text-gray-900">{item.nome}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.categoria && `${item.categoria} • `}
                          Estoque: {item.quantidade} {item.unidade || 'un'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {mostrarLista && searchTerm.length >= 2 && itensFiltrados.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-sm text-gray-500">
                    Nenhum item encontrado com estoque disponível
                  </div>
                )}
              </div>

              {erros.item && (
                <p className="mt-1.5 text-xs text-red-600">{erros.item}</p>
              )}

              {/* Item Selecionado */}
              {itemSelecionado && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Item selecionado: {itemSelecionado.nome}
                      </p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div>
                          <span className="font-medium text-gray-700">Quantidade atual em estoque:</span>{' '}
                          <strong className="text-gray-900">{itemSelecionado.quantidade} {itemSelecionado.unidade || 'peças'}</strong>
                        </div>
                        {itemSelecionado.categoria && (
                          <div>
                            <span className="font-medium text-gray-700">Categoria:</span>{' '}
                            <strong className="text-gray-900">{itemSelecionado.categoria}</strong>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-700">Unidade:</span>{' '}
                          <strong className="text-gray-900">{itemSelecionado.unidade || 'peças'}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={limparSelecao}
                      className="text-xs text-gray-500 hover:text-gray-700 ml-4"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quantidade */}
            {itemSelecionado && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quantidade a retirar *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={itemSelecionado.quantidade}
                    value={quantidade}
                    onChange={(e) => {
                      const valor = e.target.value === '' ? 1 : Math.floor(Number(e.target.value));
                      handleQuantidadeChange(valor > 0 ? valor : 1);
                    }}
                    className={`flex-1 px-4 py-2.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                      erros.quantidade ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <span className="text-sm text-gray-600 min-w-[60px]">
                    {itemSelecionado.unidade || 'un'}
                  </span>
                </div>
                {erros.quantidade && (
                  <p className="mt-1.5 text-xs text-red-600">{erros.quantidade}</p>
                )}

                {/* Retirada Rápida */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleRetiradaRapida(1)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    -1 {itemSelecionado.unidade || 'un'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetiradaRapida(5)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    -5 {itemSelecionado.unidade || 'un'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetiradaRapida(10)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    -10 {itemSelecionado.unidade || 'un'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetiradaRapida(itemSelecionado.quantidade)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    -Tudo
                  </button>
                </div>

                {/* Alerta de Estoque Baixo */}
                {alertaEstoqueBaixo && estoqueRestante >= 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-800">
                      Atenção: Estoque ficará abaixo de 10 unidades ({estoqueRestante} {itemSelecionado.unidade || 'un'} restantes).
                    </p>
                  </div>
                )}

                {/* Estoque Restante */}
                {quantidade > 0 && estoqueRestante >= 0 && (
                  <div className="mt-3 text-xs text-gray-600">
                    Estoque após saída: <strong className="text-gray-900">{estoqueRestante} {itemSelecionado.unidade || 'un'}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Responsável */}
            {itemSelecionado && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Nome do Responsável *
                </label>
                <input
                  type="text"
                  value={responsavel}
                  onChange={(e) => {
                    setResponsavel(e.target.value);
                    setErros({ ...erros, responsavel: '' });
                  }}
                  className={`w-full px-4 py-2.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                    erros.responsavel ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: João Silva, Maria Santos..."
                />
                {erros.responsavel && (
                  <p className="mt-1.5 text-xs text-red-600">{erros.responsavel}</p>
                )}
              </div>
            )}

            {/* Número do Chamado */}
            {itemSelecionado && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Número do Chamado *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={numeroChamado}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Aceitar apenas números
                    if (value === '' || /^\d+$/.test(value)) {
                      setNumeroChamado(value);
                      setErros({ ...erros, numeroChamado: '' });
                    }
                  }}
                  className={`w-full px-4 py-2.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                    erros.numeroChamado ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Digite apenas números..."
                />
                {erros.numeroChamado && (
                  <p className="mt-1.5 text-xs text-red-600">{erros.numeroChamado}</p>
                )}
              </div>
            )}

            {/* Motivo */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Motivo da Saída <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] resize-none"
                placeholder="Ex: Uso interno, Enviado para cliente, Item quebrado, Ajuste de estoque, Saída para manutenção..."
              />
            </div>

            {/* Data e Hora */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Data e Hora da Saída
              </label>
              <input
                type="datetime-local"
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
              />
              <p className="mt-2 text-xs text-gray-500">
                Por padrão, a data e hora atual são utilizadas. Você pode alterar se necessário.
              </p>
            </div>

            {/* Informações */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Usuário:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {usuario?.username?.split('@')[0] || 'Carregando...'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Data:</span>
                  <span className="ml-2 font-medium text-gray-900">{dataAtualFormatada}</span>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !itemSelecionado}
                className="flex-1 bg-[#09624b] text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-[#0a7a5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processando...' : 'Registrar Saída'}
              </button>
              <Link
                href="/estoque"
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
