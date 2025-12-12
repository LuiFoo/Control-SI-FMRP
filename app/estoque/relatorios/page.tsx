'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import Breadcrumb from '@/components/Breadcrumb';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interface para estender jsPDF com lastAutoTable
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY?: number;
  };
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
  categoria?: string;
  unidade?: string;
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [itensFiltrados, setItensFiltrados] = useState<ItemEstoque[]>([]);
  
  // Filtros
  const [tipoRelatorio, setTipoRelatorio] = useState<'todos' | 'entrada' | 'saida' | 'baixo-estoque' | 'historico-item'>('todos');
  const [periodo, setPeriodo] = useState<'hoje' | '7dias' | '30dias' | 'mes' | 'ano' | 'personalizado'>('30dias');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState<string>('');
  const [searchItem, setSearchItem] = useState('');
  const [categoria, setCategoria] = useState('');
  const [mostrarListaItens, setMostrarListaItens] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (searchItem.length >= 2) {
      filtrarItens();
      setMostrarListaItens(true);
    } else {
      setItensFiltrados([]);
      setMostrarListaItens(false);
    }
  }, [searchItem, itens]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setMostrarListaItens(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = getToken();
      
      const [movimentosRes, itensRes] = await Promise.all([
        fetch('/api/estoque/movimentos', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/estoque', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (movimentosRes.ok) {
        const data = await movimentosRes.json();
        setMovimentos(data.movimentos || []);
      }

      if (itensRes.ok) {
        const data = await itensRes.json();
        setItens(data.itens || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtrarItens = () => {
    const term = searchItem.toLowerCase().trim();
    const filtrados = itens.filter((item) =>
      item.nome.toLowerCase().includes(term)
    );
    setItensFiltrados(filtrados.slice(0, 10));
  };

  const selecionarItem = (item: ItemEstoque) => {
    setItemSelecionado(item._id);
    setSearchItem(item.nome);
    setMostrarListaItens(false);
  };

  const aplicarFiltros = () => {
    // Os filtros são aplicados automaticamente na renderização
    carregarDados();
  };

  const limparFiltros = () => {
    setTipoRelatorio('todos');
    setPeriodo('30dias');
    setDataInicio('');
    setDataFim('');
    setItemSelecionado('');
    setSearchItem('');
    setCategoria('');
  };

  const movimentosFiltrados = movimentos.filter((mov) => {
    // Filtro por tipo
    if (tipoRelatorio === 'entrada' && mov.tipo !== 'entrada') return false;
    if (tipoRelatorio === 'saida' && mov.tipo !== 'saida') return false;
    if (tipoRelatorio === 'historico-item' && mov.itemId !== itemSelecionado) return false;

    // Filtro por item
    if (itemSelecionado && mov.itemId !== itemSelecionado) return false;

    // Filtro por período
    const dataMov = new Date(mov.data);
    const agora = new Date();
    
    if (periodo === 'hoje') {
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      if (dataMov < hoje) return false;
    } else if (periodo === '7dias') {
      const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (dataMov < seteDiasAtras) return false;
    } else if (periodo === '30dias') {
      const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (dataMov < trintaDiasAtras) return false;
    } else if (periodo === 'personalizado') {
      if (dataInicio) {
        const inicio = new Date(dataInicio);
        if (dataMov < inicio) return false;
      }
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        if (dataMov > fim) return false;
      }
    }

    return true;
  });

  const itensBaixoEstoque = itens.filter((item) => {
    const minimo = item.quantidade_minima || 10;
    return item.quantidade <= minimo;
  });

  const calcularEstoqueAntes = (mov: Movimento, index: number): number => {
    // Buscar movimentos anteriores do mesmo item
    const movimentosItem = movimentosFiltrados
      .filter(m => m.itemId === mov.itemId)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    
    const posicaoAtual = movimentosItem.findIndex(m => m._id === mov._id);
    if (posicaoAtual === 0) {
      // Primeiro movimento, calcular baseado na quantidade atual
      const item = itens.find(i => i._id === mov.itemId);
      if (item) {
        let estoqueAtual = item.quantidade;
        // Subtrair todas as entradas e somar todas as saídas posteriores
        for (let i = movimentosItem.length - 1; i >= 0; i--) {
          if (movimentosItem[i].tipo === 'entrada') {
            estoqueAtual -= movimentosItem[i].quantidade;
          } else {
            estoqueAtual += movimentosItem[i].quantidade;
          }
        }
        return Math.max(0, estoqueAtual);
      }
    }
    
    // Calcular baseado no movimento anterior
    if (posicaoAtual > 0) {
      const movAnterior = movimentosItem[posicaoAtual - 1];
      if (movAnterior.tipo === 'entrada') {
        return calcularEstoqueAntes(movAnterior, 0) + movAnterior.quantidade;
      } else {
        return calcularEstoqueAntes(movAnterior, 0) - movAnterior.quantidade;
      }
    }
    
    return 0;
  };

  const calcularEstoqueDepois = (mov: Movimento): number => {
    const antes = calcularEstoqueAntes(mov, 0);
    if (mov.tipo === 'entrada') {
      return antes + mov.quantidade;
    } else {
      return Math.max(0, antes - mov.quantidade);
    }
  };

  const gerarPDF = async (): Promise<jsPDF> => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem (horizontal)
    
    // Cores
    const primaryColor = [9, 98, 75]; // #09624b
    const grayColor = [107, 114, 128]; // gray-600
    
    // Carregar e adicionar logo
    try {
      const response = await fetch('/background.png');
      const blob = await response.blob();
      const imageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      // Dimensões originais da imagem: 1728px x 2515px
      // Proporção: 1728/2515 ≈ 0.687
      // Usar largura menor mas mantendo boa resolução (25mm)
      const larguraLogo = 25; // mm
      const alturaLogo = larguraLogo / (1728 / 2515); // Calcula altura proporcional
      
      // Adicionar logo no topo com melhor resolução
      doc.addImage(imageUrl, 'PNG', 20, 10, larguraLogo, alturaLogo, undefined, 'FAST');
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
    
    // Título - Control SI-FMRP (mais próximo da logo)
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Control SI-FMRP', 50, 18);
    
    // Título do relatório abaixo do Control SI-FMRP
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    let tituloRelatorio = 'Relatório Completo de Estoque';
    if (tipoRelatorio === 'entrada') tituloRelatorio = 'Relatório de Entradas';
    else if (tipoRelatorio === 'saida') tituloRelatorio = 'Relatório de Saídas';
    else if (tipoRelatorio === 'baixo-estoque') tituloRelatorio = 'Itens com Baixo Estoque';
    else if (tipoRelatorio === 'historico-item') tituloRelatorio = 'Histórico do Item';
    
    doc.text(tituloRelatorio, 50, 24);
    
    // Informações do período abaixo do título do relatório
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let periodoTexto = 'Período: ';
    if (periodo === 'hoje') periodoTexto += 'Hoje';
    else if (periodo === '7dias') periodoTexto += 'Últimos 7 dias';
    else if (periodo === '30dias') periodoTexto += 'Últimos 30 dias';
    else if (periodo === 'personalizado') {
      periodoTexto += `${dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : ''} até ${dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : ''}`;
    }
    doc.text(periodoTexto, 50, 29);
    
    // Data de geração
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 190, 20, { align: 'right' });
    
    // Preparar dados da tabela
    type TableRow = (string | number)[];
    let tableData: TableRow[] = [];
    let tableHeaders: string[] = [];
    
    if (tipoRelatorio === 'baixo-estoque') {
      tableHeaders = ['Item', 'Quantidade Atual', 'Mínimo Ideal', 'Categoria', 'Última Movimentação'];
      tableData = itensBaixoEstoque.map((item) => {
        const ultimoMov = movimentos
          .filter(m => m.itemId === item._id)
          .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
        return [
          item.nome,
          `${item.quantidade} ${item.unidade || 'un'}`,
          `${item.quantidade_minima || 10} ${item.unidade || 'un'}`,
          item.categoria || '-',
          ultimoMov ? new Date(ultimoMov.data).toLocaleDateString('pt-BR') : '-'
        ];
      });
    } else {
      if (tipoRelatorio === 'todos') {
        tableHeaders = ['Tipo', 'Data', 'Item', 'Quantidade', 'Estoque Antes', 'Estoque Depois', 'Responsável', 'Nº Chamado', 'Usuário', 'Observação'];
      } else if (tipoRelatorio === 'saida') {
        tableHeaders = ['Data', 'Item', 'Quantidade', 'Estoque Antes', 'Estoque Depois', 'Responsável', 'Motivo', 'Nº Chamado', 'Usuário'];
      } else {
        tableHeaders = ['Data', 'Item', 'Quantidade', 'Estoque Antes', 'Estoque Depois', 'Usuário', 'Observação'];
      }
      
      tableData = movimentosFiltrados.map((mov) => {
        const estoqueAntes = calcularEstoqueAntes(mov, 0);
        const estoqueDepois = calcularEstoqueDepois(mov);
        const dataFormatada = new Date(mov.data).toLocaleString('pt-BR');
        
        if (tipoRelatorio === 'todos') {
          return [
            mov.tipo === 'entrada' ? 'Entrada' : 'Saída',
            dataFormatada,
            mov.itemNome,
            `${mov.tipo === 'entrada' ? '+' : '-'}${mov.quantidade}`,
            estoqueAntes.toString(),
            estoqueDepois.toString(),
            mov.responsavel || mov.setor || (mov.tipo === 'entrada' ? '-' : '-'),
            mov.numeroChamado || '-',
            mov.usuarioNome ? mov.usuarioNome.split('@')[0] : '-',
            mov.observacoes || '-'
          ];
        } else if (tipoRelatorio === 'saida') {
          return [
            dataFormatada,
            mov.itemNome,
            `-${mov.quantidade}`,
            estoqueAntes.toString(),
            estoqueDepois.toString(),
            mov.responsavel || mov.setor || '-',
            mov.observacoes || '-',
            mov.numeroChamado || '-',
            mov.usuarioNome ? mov.usuarioNome.split('@')[0] : '-'
          ];
        } else {
          return [
            dataFormatada,
            mov.itemNome,
            `+${mov.quantidade}`,
            estoqueAntes.toString(),
            estoqueDepois.toString(),
            mov.usuarioNome ? mov.usuarioNome.split('@')[0] : '-',
            mov.observacoes || '-'
          ];
        }
      });
    }
    
    // Gerar tabela
    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 50,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251], // gray-50
      },
      margin: { top: 55, left: 15, right: 15 },
    });
    
    // Rodapé com totais
    const finalY = (doc as jsPDFWithAutoTable).lastAutoTable?.finalY || 55;
    let yPos = finalY + 8;
    
    if (tipoRelatorio !== 'baixo-estoque' && movimentosFiltrados.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      
      const totalEntradas = movimentosFiltrados.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + m.quantidade, 0);
      const totalSaidas = movimentosFiltrados.filter(m => m.tipo === 'saida').reduce((sum, m) => sum + m.quantidade, 0);
      
      doc.text(`Total de registros: ${movimentosFiltrados.length}`, 20, yPos);
      doc.text(`Total entradas: +${totalEntradas}`, 100, yPos);
      doc.text(`Total saídas: -${totalSaidas}`, 150, yPos);
    }
    
    // Rodapé da página
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Control SI-FMRP - Sistema de Controle de Estoque', 105, pageHeight - 10, { align: 'center' });
    doc.text(`Página 1`, 190, pageHeight - 10, { align: 'right' });
    
    return doc;
  };

  const exportarPDF = async () => {
    const doc = await gerarPDF();
    const nomeArquivo = `relatorio-estoque-${tipoRelatorio}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
  };

  const imprimir = async () => {
    // Gerar o PDF e abrir a janela de impressão
    const doc = await gerarPDF();
    // Criar um blob do PDF
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Abrir o PDF em uma nova janela e acionar a impressão
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  };

  const categorias = Array.from(new Set(itens.map(item => item.categoria).filter(Boolean)));

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando relatórios...</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Relatórios e Histórico de Estoque</h1>
            <p className="text-sm text-gray-500">Acompanhe todas as entradas e saídas registradas no sistema.</p>
          </div>

          {/* Painel de Filtros */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Filtros</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tipo de Relatório */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de Relatório</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTipoRelatorio('todos')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      tipoRelatorio === 'todos'
                        ? 'bg-[#09624b] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoRelatorio('entrada')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      tipoRelatorio === 'entrada'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Entradas
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoRelatorio('saida')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      tipoRelatorio === 'saida'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Saídas
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoRelatorio('baixo-estoque')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      tipoRelatorio === 'baixo-estoque'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Baixo Estoque
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoRelatorio('historico-item')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      tipoRelatorio === 'historico-item'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Histórico Item
                  </button>
                </div>
              </div>

              {/* Período */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Período</label>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as 'hoje' | '7dias' | '30dias' | 'mes' | 'ano' | 'personalizado')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                >
                  <option value="hoje">Hoje</option>
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="personalizado">Intervalo personalizado</option>
                </select>
              </div>

              {/* Datas personalizadas */}
              {periodo === 'personalizado' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Data Início</label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Data Fim</label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                    />
                  </div>
                </>
              )}

              {/* Item (autocomplete) */}
              {(tipoRelatorio === 'historico-item' || tipoRelatorio === 'todos') && (
                <div className="relative" ref={searchRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Item</label>
                  <input
                    type="text"
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                    onFocus={() => {
                      if (searchItem.length >= 2) setMostrarListaItens(true);
                    }}
                    placeholder="Digite para buscar item..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                  />
                  {mostrarListaItens && itensFiltrados.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {itensFiltrados.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => selecionarItem(item)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                        >
                          {item.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Categoria */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Categoria</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#09624b] focus:border-[#09624b]"
                >
                  <option value="">Todas</option>
                  {categorias.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={aplicarFiltros}
                className="px-4 py-2 bg-[#09624b] text-white rounded-md text-sm font-medium hover:bg-[#0a7a5f] transition-colors"
              >
                Aplicar Filtros
              </button>
              <button
                onClick={limparFiltros}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* Resultados */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {tipoRelatorio === 'baixo-estoque' 
                  ? 'Itens com Baixo Estoque'
                  : tipoRelatorio === 'historico-item'
                  ? 'Histórico do Item'
                  : tipoRelatorio === 'entrada'
                  ? 'Relatório de Entradas'
                  : tipoRelatorio === 'saida'
                  ? 'Relatório de Saídas'
                  : 'Relatório Completo'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={exportarPDF}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  PDF
                </button>
                <button
                  onClick={imprimir}
                  className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Imprimir
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {tipoRelatorio === 'baixo-estoque' ? (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantidade Atual</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mínimo Ideal</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Categoria</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Última Movimentação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {itensBaixoEstoque.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          Nenhum item com estoque baixo encontrado
                        </td>
                      </tr>
                    ) : (
                      itensBaixoEstoque.map((item) => {
                        const ultimoMov = movimentos
                          .filter(m => m.itemId === item._id)
                          .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
                        
                        return (
                          <tr key={item._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">{item.nome}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{item.quantidade} {item.unidade || 'un'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{item.quantidade_minima || 10} {item.unidade || 'un'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{item.categoria || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {ultimoMov ? new Date(ultimoMov.data).toLocaleDateString('pt-BR') : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {tipoRelatorio === 'todos' && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantidade</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Estoque Antes</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Estoque Depois</th>
                      {(tipoRelatorio === 'saida' || tipoRelatorio === 'todos') && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Responsável</th>
                      )}
                      {tipoRelatorio === 'saida' && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Motivo</th>
                      )}
                      {(tipoRelatorio === 'saida' || tipoRelatorio === 'todos') && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nº Chamado</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Usuário</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {movimentosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={tipoRelatorio === 'todos' ? 11 : tipoRelatorio === 'saida' ? 10 : 7} className="px-6 py-8 text-center text-gray-500">
                          Nenhum movimento encontrado
                        </td>
                      </tr>
                    ) : (
                      movimentosFiltrados.map((mov) => {
                        const estoqueAntes = calcularEstoqueAntes(mov, 0);
                        const estoqueDepois = calcularEstoqueDepois(mov);
                        
                        return (
                          <tr key={mov._id} className="hover:bg-gray-50">
                            {tipoRelatorio === 'todos' && (
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  mov.tipo === 'entrada'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                                </span>
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(mov.data).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{mov.itemNome}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {mov.tipo === 'entrada' ? '+' : '-'}{mov.quantidade}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{estoqueAntes}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{estoqueDepois}</td>
                            {(tipoRelatorio === 'saida' || tipoRelatorio === 'todos') && (
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {mov.responsavel || mov.setor || '-'}
                              </td>
                            )}
                            {tipoRelatorio === 'saida' && (
                              <td className="px-6 py-4 text-sm text-gray-600">{mov.observacoes || '-'}</td>
                            )}
                            {(tipoRelatorio === 'saida' || tipoRelatorio === 'todos') && (
                              <td className="px-6 py-4 text-sm text-gray-600">{mov.numeroChamado || '-'}</td>
                            )}
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {mov.usuarioNome ? mov.usuarioNome.split('@')[0] : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{mov.observacoes || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Totais */}
            {tipoRelatorio !== 'baixo-estoque' && movimentosFiltrados.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="text-gray-600">Total de registros: </span>
                    <span className="font-semibold text-gray-900">{movimentosFiltrados.length}</span>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <span className="text-gray-600">Total entradas: </span>
                      <span className="font-semibold text-green-700">
                        +{movimentosFiltrados.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + m.quantidade, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total saídas: </span>
                      <span className="font-semibold text-red-700">
                        -{movimentosFiltrados.filter(m => m.tipo === 'saida').reduce((sum, m) => sum + m.quantidade, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
