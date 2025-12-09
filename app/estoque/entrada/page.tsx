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
  quantidade_minima?: number;
  categoria?: string;
  unidade?: string;
  descricao?: string;
}

export default function EntradaPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [itensFiltrados, setItensFiltrados] = useState<ItemEstoque[]>([]);
  const [itemSelecionado, setItemSelecionado] = useState<ItemEstoque | null>(null);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [mostrarCriarNovo, setMostrarCriarNovo] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState('');
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
  const searchRef = useRef<HTMLDivElement>(null);

  const [novoItemNome, setNovoItemNome] = useState('');
  const [novoItemCategoria, setNovoItemCategoria] = useState('');
  const [novoItemUnidade, setNovoItemUnidade] = useState('un');
  const [novoItemQuantidade, setNovoItemQuantidade] = useState(1);
  const [novoItemQuantidadeMinima, setNovoItemQuantidadeMinima] = useState(0);
  const [quantidadeMinima, setQuantidadeMinima] = useState<number | null>(null);

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
        setItens(data.itens || []);
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
    setQuantidadeMinima(item.quantidade_minima ?? null);
    setErros({});
  };

  const limparSelecao = () => {
    setItemSelecionado(null);
    setSearchTerm('');
    setQuantidade(1);
    setQuantidadeMinima(null);
    setObservacoes('');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setDataHora(`${year}-${month}-${day}T${hours}:${minutes}`);
    setErros({});
  };

  const handleEntradaRapida = (valor: number) => {
    setQuantidade(valor);
    setErros({ ...erros, quantidade: '' });
  };

  const abrirCriarNovo = () => {
    setMostrarCriarNovo(true);
    setItemSelecionado(null);
    setSearchTerm('');
    setNovoItemNome('');
    setNovoItemCategoria('');
    setNovoItemUnidade('un');
    setNovoItemQuantidade(1);
    setNovoItemQuantidadeMinima(0);
  };

  const fecharCriarNovo = () => {
    setMostrarCriarNovo(false);
    setErros({});
  };

  const validarFormulario = (): boolean => {
    const novosErros: { [key: string]: string } = {};
    if (mostrarCriarNovo) {
      if (!novoItemNome.trim()) novosErros.novoItemNome = 'Nome do item é obrigatório';
      if (!novoItemCategoria.trim()) novosErros.novoItemCategoria = 'Categoria é obrigatória';
      if (!novoItemQuantidade || novoItemQuantidade <= 0) novosErros.novoItemQuantidade = 'Quantidade deve ser maior que zero';
    } else {
      if (!itemSelecionado) novosErros.item = 'Selecione um item ou crie um novo';
      if (!quantidade || quantidade <= 0) novosErros.quantidade = 'Quantidade deve ser maior que zero';
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    try {
      setSubmitting(true);
      const token = getToken();

      if (mostrarCriarNovo) {
        const response = await fetch('/api/estoque/entrada-novo-item', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nome: novoItemNome.trim(),
            categoria: novoItemCategoria.trim(),
            unidade: novoItemUnidade,
            quantidade: Number(novoItemQuantidade),
            quantidade_minima: Number(novoItemQuantidadeMinima) || 0,
            observacoes: observacoes.trim() || null,
          }),
        });

        if (response.ok) {
          alert('Item criado e entrada registrada com sucesso!');
          await carregarItens();
          limparSelecao();
          fecharCriarNovo();
          router.push('/estoque');
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao criar item e registrar entrada');
        }
      } else if (itemSelecionado) {
        const response = await fetch('/api/estoque/movimentos', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tipo: 'entrada',
            itemId: itemSelecionado._id,
            quantidade: Number(quantidade),
            quantidade_minima: quantidadeMinima !== null ? Number(quantidadeMinima) : undefined,
            observacoes: observacoes.trim() || null,
            data: dataHora ? new Date(dataHora).toISOString() : new Date().toISOString(),
          }),
        });

        if (response.ok) {
          alert('Entrada registrada com sucesso!');
          limparSelecao();
          router.push('/estoque');
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao registrar entrada');
        }
      }
    } catch (error) {
      console.error('Erro ao processar entrada:', error);
      alert('Erro ao processar entrada');
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-4">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Registrar Entrada de Estoque</h1>
            <p className="text-sm text-gray-500">Registre a entrada de itens no estoque</p>
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
                  disabled={mostrarCriarNovo}
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
                    Nenhum item encontrado
                  </div>
                )}
              </div>

              {erros.item && (
                <p className="mt-1.5 text-xs text-red-600">{erros.item}</p>
              )}

              {!mostrarCriarNovo && (
                <button
                  type="button"
                  onClick={abrirCriarNovo}
                  className="mt-3 text-sm text-[#09624b] hover:text-[#0a7a5f] font-medium"
                >
                  + Criar novo item
                </button>
              )}

              {/* Item Selecionado */}
              {itemSelecionado && !mostrarCriarNovo && (
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

              {/* Form Criar Novo */}
              {mostrarCriarNovo && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Novo Item</h3>
                    <button
                      type="button"
                      onClick={fecharCriarNovo}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Nome *</label>
                    <input
                      type="text"
                      value={novoItemNome}
                      onChange={(e) => {
                        setNovoItemNome(e.target.value);
                        setErros({ ...erros, novoItemNome: '' });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                        erros.novoItemNome ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {erros.novoItemNome && (
                      <p className="mt-1 text-xs text-red-600">{erros.novoItemNome}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Categoria *</label>
                      <input
                        type="text"
                        value={novoItemCategoria}
                        onChange={(e) => {
                          setNovoItemCategoria(e.target.value);
                          setErros({ ...erros, novoItemCategoria: '' });
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                          erros.novoItemCategoria ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {erros.novoItemCategoria && (
                        <p className="mt-1 text-xs text-red-600">{erros.novoItemCategoria}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Unidade *</label>
                      <select
                        value={novoItemUnidade}
                        onChange={(e) => setNovoItemUnidade(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                      >
                        <option value="un">un</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="mL">mL</option>
                        <option value="m">m</option>
                        <option value="cm">cm</option>
                        <option value="caixa">caixa</option>
                        <option value="saco">saco</option>
                        <option value="rolo">rolo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Quantidade Inicial *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={novoItemQuantidade}
                        onChange={(e) => {
                          const valor = e.target.value === '' ? 1 : Math.floor(Number(e.target.value));
                          setNovoItemQuantidade(valor > 0 ? valor : 1);
                          setErros({ ...erros, novoItemQuantidade: '' });
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] ${
                          erros.novoItemQuantidade ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {erros.novoItemQuantidade && (
                        <p className="mt-1 text-xs text-red-600">{erros.novoItemQuantidade}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Quantidade Mínima</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={novoItemQuantidadeMinima}
                        onChange={(e) => {
                          const valor = e.target.value === '' ? 0 : Math.floor(Number(e.target.value));
                          setNovoItemQuantidadeMinima(valor >= 0 ? valor : 0);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                        placeholder="0"
                      />
                      <p className="mt-1 text-xs text-gray-500">Alerta quando estoque estiver baixo</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quantidade */}
            {!mostrarCriarNovo && itemSelecionado && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quantidade de Entrada *
                  </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantidade}
                    onChange={(e) => {
                      const valor = e.target.value === '' ? 1 : Math.floor(Number(e.target.value));
                      setQuantidade(valor > 0 ? valor : 1);
                      setErros({ ...erros, quantidade: '' });
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

                {/* Entrada Rápida */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleEntradaRapida(1)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    +1 {itemSelecionado.unidade || 'un'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntradaRapida(5)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    +5 {itemSelecionado.unidade || 'un'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntradaRapida(10)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    +10 {itemSelecionado.unidade || 'un'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntradaRapida(50)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    +50 {itemSelecionado.unidade || 'un'}
                  </button>
                </div>

                  {/* Estoque Após Entrada */}
                  {quantidade > 0 && (
                    <div className="mt-3 text-xs text-gray-600">
                      Estoque após entrada: <strong className="text-gray-900">{itemSelecionado.quantidade + quantidade} {itemSelecionado.unidade || 'un'}</strong>
                    </div>
                  )}
                </div>

                {/* Quantidade Mínima */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quantidade Mínima (Alerta de Estoque Baixo)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={quantidadeMinima ?? ''}
                      onChange={(e) => {
                        const valor = e.target.value === '' ? null : Math.floor(Number(e.target.value));
                        setQuantidadeMinima(valor !== null && valor >= 0 ? valor : null);
                      }}
                      className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                      placeholder="Ex: 10"
                    />
                    <span className="text-sm text-gray-600 min-w-[60px]">
                      {itemSelecionado.unidade || 'un'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {quantidadeMinima !== null 
                      ? `O sistema alertará quando o estoque estiver em ${quantidadeMinima} ${itemSelecionado.unidade || 'un'} ou menos.`
                      : 'Deixe em branco para não definir alerta de estoque baixo.'}
                  </p>
                  {itemSelecionado.quantidade_minima !== undefined && itemSelecionado.quantidade_minima !== null && (
                    <p className="mt-1 text-xs text-gray-400">
                      Valor atual: {itemSelecionado.quantidade_minima} {itemSelecionado.unidade || 'un'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Observações <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b] resize-none"
                placeholder="Ex: Reposição semanal, Devolução, Compra nova..."
              />
            </div>

            {/* Data e Hora */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Data e Hora da Entrada
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
                disabled={submitting || (mostrarCriarNovo ? false : !itemSelecionado)}
                className="flex-1 bg-[#09624b] text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-[#0a7a5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processando...' : 'Confirmar Entrada'}
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
