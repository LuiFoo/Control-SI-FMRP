'use client';

import { useState, useEffect, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import { useSearchParams, useRouter } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ItemRevisao {
  item_id: string;
  nome_item: string;
  sistema: number;
  contado: number | null;
  status: 'certo' | 'errado' | null;
}

interface Revisao {
  _id: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  usuario: string;
  status: string;
  itens: ItemRevisao[];
}

function VisualizarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'certo' | 'errado'>('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const id = searchParams?.get('id');
    if (id) {
      carregarRevisao(id);
    } else {
      setError('ID da revisão não fornecido');
      setLoading(false);
    }
  }, [searchParams]);

  const carregarRevisao = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      
      if (!token) {
        setError('Token não encontrado. Faça login novamente.');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/estoque/revisoes?id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.revisao) {
          // Garantir que todos os itens tenham dados válidos
          const revisaoFormatada = {
            ...data.revisao,
            itens: Array.isArray(data.revisao.itens) 
              ? data.revisao.itens.map((item: any) => {
                  // Normalizar contado - preservar o valor se existir, converter para número
                  let contado: number | null = null;
                  if (item.contado !== null && item.contado !== undefined && item.contado !== '') {
                    const contadoNum = typeof item.contado === 'number' ? item.contado : Number(item.contado);
                    contado = isNaN(contadoNum) ? null : contadoNum;
                  }
                  
                  // Normalizar sistema - sempre deve ser número
                  let sistema = 0;
                  if (item.sistema !== null && item.sistema !== undefined) {
                    const sistemaNum = typeof item.sistema === 'number' ? item.sistema : Number(item.sistema);
                    sistema = isNaN(sistemaNum) ? 0 : sistemaNum;
                  }
                  
                  return {
                    item_id: item.item_id || '',
                    nome_item: item.nome_item || '',
                    sistema: sistema,
                    contado: contado,
                    status: item.status || null,
                  };
                })
              : []
          };
          setRevisao(revisaoFormatada);
        } else {
          setError('Revisão não encontrada');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erro ao carregar revisão');
      }
    } catch (error) {
      console.error('Erro ao carregar revisão:', error);
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // Garantir que itens seja um array e filtrar corretamente
  const itensArray = Array.isArray(revisao?.itens) ? revisao.itens : [];
  const itensCertos = itensArray.filter(i => i && i.status === 'certo');
  const itensErrados = itensArray.filter(i => i && i.status === 'errado');
  
  // Filtrar itens baseado no filtro e busca
  const itensFiltrados = itensArray.filter(item => {
    if (!item) return false;
    
    // Filtro por status
    if (filtroStatus === 'certo' && item.status !== 'certo') return false;
    if (filtroStatus === 'errado' && item.status !== 'errado') return false;
    
    // Busca por nome
    if (busca.trim()) {
      const buscaLower = busca.toLowerCase().trim();
      return item.nome_item?.toLowerCase().includes(buscaLower);
    }
    
    return true;
  });
  
  // Calcular estatísticas - garantir que contado e sistema sejam números
  const totalDiferenca = itensArray.reduce((sum, item) => {
    const contado = typeof item.contado === 'number' ? item.contado : 0;
    const sistema = typeof item.sistema === 'number' ? item.sistema : 0;
    return sum + (contado - sistema);
  }, 0);
  const diferencaPositiva = itensArray.filter(i => {
    const contado = typeof i.contado === 'number' ? i.contado : 0;
    const sistema = typeof i.sistema === 'number' ? i.sistema : 0;
    return contado > sistema;
  }).length;
  const diferencaNegativa = itensArray.filter(i => {
    const contado = typeof i.contado === 'number' ? i.contado : 0;
    const sistema = typeof i.sistema === 'number' ? i.sistema : 0;
    return contado < sistema;
  }).length;

  const gerarPDF = async (): Promise<jsPDF> => {
    if (!revisao) throw new Error('Revisão não encontrada');

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
      
      const larguraLogo = 25; // mm
      const alturaLogo = larguraLogo / (1728 / 2515);
      
      doc.addImage(imageUrl, 'PNG', 20, 10, larguraLogo, alturaLogo, undefined, 'FAST');
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
    
    // Título - Control SI-FMRP
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Control SI-FMRP', 50, 18);
    
    // Título do relatório
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Revisão de Estoque', 50, 24);
    
    // Informações do período
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const mesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][revisao.mes - 1];
    doc.text(`Período: ${mesNome}/${revisao.ano}`, 50, 29);
    doc.text(`Data da revisão: ${new Date(revisao.data_fim).toLocaleDateString('pt-BR')}`, 50, 33);
    doc.text(`Usuário: ${revisao.usuario}`, 50, 37);
    
    // Data de geração
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 190, 20, { align: 'right' });
    
    // Preparar dados da tabela - Itens Certos
    const tableHeadersCertos = ['Item', 'Quantidade Sistema', 'Quantidade Contada', 'Diferença', 'Status'];
    const tableDataCertos = itensCertos.map((item) => {
      const diferenca = (item.contado || 0) - (item.sistema || 0);
      const diferencaTexto = diferenca > 0 ? `+${diferenca}` : diferenca.toString();
      return [
        item.nome_item,
        (item.sistema || 0).toString(),
        (item.contado || 0).toString(),
        diferencaTexto,
        '✓ Certo'
      ];
    });
    
    // Gerar tabela de itens certos
    if (tableDataCertos.length > 0) {
      autoTable(doc, {
        head: [['Itens Certos']],
        body: [[`Total: ${itensCertos.length} itens`]],
        startY: 50,
        styles: {
          fontSize: 10,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [34, 197, 94], // green-500
          textColor: 255,
          fontStyle: 'bold',
        },
        margin: { top: 50, left: 15, right: 15 },
      });
      
      const yAfterHeader = (doc as any).lastAutoTable?.finalY || 50;
      
      autoTable(doc, {
        head: [tableHeadersCertos],
        body: tableDataCertos,
        startY: yAfterHeader + 5,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [34, 197, 94], // green-500
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [240, 253, 244], // green-50
        },
        margin: { top: yAfterHeader + 5, left: 15, right: 15 },
      });
    }
    
    // Preparar dados da tabela - Itens Errados
    const tableHeadersErrados = ['Item', 'Quantidade Sistema', 'Quantidade Contada', 'Diferença', 'Status'];
    const tableDataErrados = itensErrados.map((item) => {
      const diferenca = (item.contado || 0) - (item.sistema || 0);
      const diferencaTexto = diferenca > 0 ? `+${diferenca}` : diferenca.toString();
      return [
        item.nome_item,
        (item.sistema || 0).toString(),
        (item.contado || 0).toString(),
        diferencaTexto,
        '✖ Errado'
      ];
    });
    
    // Gerar tabela de itens errados
    if (tableDataErrados.length > 0) {
      const yAfterCertos = (doc as any).lastAutoTable?.finalY || 50;
      
      autoTable(doc, {
        head: [['Itens com Diferença']],
        body: [[`Total: ${itensErrados.length} itens`]],
        startY: yAfterCertos + 10,
        styles: {
          fontSize: 10,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [239, 68, 68], // red-500
          textColor: 255,
          fontStyle: 'bold',
        },
        margin: { top: yAfterCertos + 10, left: 15, right: 15 },
      });
      
      const yAfterHeaderErrados = (doc as any).lastAutoTable?.finalY || yAfterCertos + 10;
      
      autoTable(doc, {
        head: [tableHeadersErrados],
        body: tableDataErrados,
        startY: yAfterHeaderErrados + 5,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [239, 68, 68], // red-500
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242], // red-50
        },
        margin: { top: yAfterHeaderErrados + 5, left: 15, right: 15 },
      });
    }
    
    // Rodapé com totais
    const finalY = (doc as any).lastAutoTable?.finalY || 55;
    let yPos = finalY + 8;
    
    if (itensArray.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      
      doc.text(`Total de itens: ${itensArray.length}`, 20, yPos);
      doc.text(`Itens certos: ${itensCertos.length}`, 100, yPos);
      doc.text(`Itens errados: ${itensErrados.length}`, 150, yPos);
      
      const totalDiferenca = itensArray.reduce((sum, item) => sum + ((item.contado || 0) - (item.sistema || 0)), 0);
      doc.text(`Diferença total: ${totalDiferenca > 0 ? '+' : ''}${totalDiferenca}`, 200, yPos);
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
    if (!revisao) return;
    const doc = await gerarPDF();
    const nomeArquivo = `revisao-estoque-visualizar-${revisao.mes}-${revisao.ano}.pdf`;
    doc.save(nomeArquivo);
  };

  const imprimir = async () => {
    if (!revisao) return;
    const doc = await gerarPDF();
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#09624b] mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando revisão...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !revisao) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-4">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Breadcrumb />
            <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 font-medium mb-2">{error || 'Revisão não encontrada'}</p>
              <button
                onClick={() => router.push('/estoque/verificacao/historico')}
                className="mt-4 px-4 py-2 bg-[#09624b] text-white rounded-lg hover:bg-[#0a7a5f] transition-colors"
              >
                Voltar para Histórico
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const mesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][revisao.mes - 1];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-4">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Revisão de Estoque</h1>
            <p className="text-sm text-gray-500">
              {mesNome} / {revisao.ano} • {new Date(revisao.data_fim).toLocaleDateString('pt-BR')} • {revisao.usuario}
            </p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Total Conferidos</p>
              <p className="text-3xl font-bold text-gray-900">{itensArray.length}</p>
              <p className="text-xs text-gray-500 mt-1">100%</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-6 shadow-sm">
              <p className="text-sm text-green-700 mb-1">Itens Certos</p>
              <p className="text-3xl font-bold text-green-800">{itensCertos.length}</p>
              <p className="text-xs text-green-600 mt-1">
                {itensArray.length > 0 ? ((itensCertos.length / itensArray.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-6 shadow-sm">
              <p className="text-sm text-red-700 mb-1">Itens Errados</p>
              <p className="text-3xl font-bold text-red-800">{itensErrados.length}</p>
              <p className="text-xs text-red-600 mt-1">
                {itensArray.length > 0 ? ((itensErrados.length / itensArray.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 shadow-sm">
              <p className="text-sm text-blue-700 mb-1">Diferença Total</p>
              <p className={`text-3xl font-bold ${totalDiferenca >= 0 ? 'text-blue-800' : 'text-red-800'}`}>
                {totalDiferenca > 0 ? '+' : ''}{totalDiferenca}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {diferencaPositiva} positivas, {diferencaNegativa} negativas
              </p>
            </div>
          </div>

          {/* Informações da Revisão */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600 block mb-1">Período</span>
                <span className="font-semibold text-gray-900">{mesNome} / {revisao.ano}</span>
              </div>
              <div>
                <span className="text-gray-600 block mb-1">Data Início</span>
                <span className="font-semibold text-gray-900">
                  {new Date(revisao.data_inicio).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div>
                <span className="text-gray-600 block mb-1">Data Fim</span>
                <span className="font-semibold text-gray-900">
                  {new Date(revisao.data_fim).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div>
                <span className="text-gray-600 block mb-1">Usuário</span>
                <span className="font-semibold text-gray-900">{revisao.usuario}</span>
              </div>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nome do item..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09624b] focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFiltroStatus('todos')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filtroStatus === 'todos'
                      ? 'bg-[#09624b] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todos ({itensArray.length})
                </button>
                <button
                  onClick={() => setFiltroStatus('certo')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filtroStatus === 'certo'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Certos ({itensCertos.length})
                </button>
                <button
                  onClick={() => setFiltroStatus('errado')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filtroStatus === 'errado'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Errados ({itensErrados.length})
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Itens da Revisão ({itensFiltrados.length} de {itensArray.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={exportarPDF}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF
                </button>
                <button
                  onClick={imprimir}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sistema</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {busca ? 'Nenhum item encontrado com essa busca.' : 'Nenhum item encontrado.'}
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item, index) => {
                      const contado = typeof item.contado === 'number' ? item.contado : (item.contado !== null && item.contado !== undefined ? Number(item.contado) : null);
                      const sistema = typeof item.sistema === 'number' ? item.sistema : (item.sistema !== null && item.sistema !== undefined ? Number(item.sistema) : 0);
                      const diferenca = contado !== null ? contado - sistema : 0;
                      const isErrado = item.status === 'errado';
                      return (
                        <tr 
                          key={item.item_id || index} 
                          className={`hover:bg-gray-50 transition-colors ${
                            isErrado ? 'bg-red-50' : item.status === 'certo' ? 'bg-green-50' : 'bg-gray-50'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.nome_item || 'Item sem nome'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-900">{sistema}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className={`text-sm font-medium ${
                              contado !== null ? 'text-gray-900' : 'text-gray-400 italic'
                            }`}>
                              {contado !== null && contado !== undefined ? contado : 'Não contado'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className={`text-sm font-semibold ${
                              contado === null ? 'text-gray-400' :
                              diferenca > 0 ? 'text-blue-600' : diferenca < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {contado !== null ? (diferenca > 0 ? '+' : '') + diferenca : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isErrado 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {isErrado ? '✖ Errado' : '✓ Certo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/estoque/verificacao/historico')}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Ver Histórico
            </button>
            <button
              onClick={() => router.push('/estoque')}
              className="px-6 py-2 bg-[#09624b] text-white rounded-lg hover:bg-[#0a7a5f] transition-colors"
            >
              Voltar para Estoque
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function VisualizarPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Carregando...</p>
        </div>
      </ProtectedRoute>
    }>
      <VisualizarContent />
    </Suspense>
  );
}

