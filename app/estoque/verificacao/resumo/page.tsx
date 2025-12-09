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
  contado: number;
  status: 'certo' | 'errado';
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

function ResumoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'certo' | 'errado'>('todos');

  useEffect(() => {
    const id = searchParams?.get('id');
    if (id) {
      carregarRevisao(id);
    }
  }, [searchParams]);

  const carregarRevisao = async (id: string) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/estoque/revisoes?id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRevisao(data.revisao);
      }
    } catch (error) {
      console.error('Erro ao carregar revisão:', error);
    } finally {
      setLoading(false);
    }
  };

  // Garantir que itens seja um array e filtrar corretamente
  const itensArray = revisao && revisao.itens ? (Array.isArray(revisao.itens) ? revisao.itens : []) : [];
  const itensCertos = itensArray.filter(i => i && i.status === 'certo');
  const itensErrados = itensArray.filter(i => i && i.status === 'errado');
  
  // Filtrar itens baseado no filtro selecionado
  const itensFiltrados = filtroStatus === 'todos' 
    ? itensArray 
    : filtroStatus === 'certo' 
    ? itensCertos 
    : itensErrados;

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
    let tituloRelatorio = 'Relatório de Revisão de Estoque';
    if (filtroStatus === 'certo') tituloRelatorio = 'Relatório de Revisão - Itens Certos';
    else if (filtroStatus === 'errado') tituloRelatorio = 'Relatório de Revisão - Itens com Diferença';
    
    doc.text(tituloRelatorio, 50, 24);
    
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
    
    // Preparar dados da tabela
    const tableHeaders = ['Item', 'Quantidade Sistema', 'Quantidade Contada', 'Diferença', 'Status'];
    const tableData = itensFiltrados.map((item) => {
      const diferenca = item.contado - item.sistema;
      const diferencaTexto = diferenca > 0 ? `+${diferenca}` : diferenca.toString();
      return [
        item.nome_item,
        item.sistema.toString(),
        item.contado.toString(),
        diferencaTexto,
        item.status === 'certo' ? '✓ Certo' : '✖ Errado'
      ];
    });
    
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
    const finalY = (doc as any).lastAutoTable?.finalY || 55;
    let yPos = finalY + 8;
    
    if (itensFiltrados.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      
      doc.text(`Total de itens: ${itensFiltrados.length}`, 20, yPos);
      doc.text(`Itens certos: ${itensCertos.length}`, 100, yPos);
      doc.text(`Itens errados: ${itensErrados.length}`, 150, yPos);
      
      if (filtroStatus === 'todos') {
        const totalDiferenca = itensFiltrados.reduce((sum, item) => sum + (item.contado - item.sistema), 0);
        doc.text(`Diferença total: ${totalDiferenca > 0 ? '+' : ''}${totalDiferenca}`, 200, yPos);
      }
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
    const nomeArquivo = `revisao-estoque-${filtroStatus}-${revisao.mes}-${revisao.ano}.pdf`;
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
          <p className="text-gray-600">Carregando...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (!revisao) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-4">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Breadcrumb />
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Revisão não encontrada.</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Relatório de Revisão de Estoque</h1>
            <p className="text-sm text-gray-500">Acompanhe os resultados da revisão de estoque realizada.</p>
          </div>

          {/* Painel de Filtros */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Filtros</h2>
            
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filtroStatus === 'todos'
                    ? 'bg-[#09624b] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('certo')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filtroStatus === 'certo'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Certos
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('errado')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filtroStatus === 'errado'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Com Diferença
              </button>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-1">Total Conferidos</p>
              <p className="text-3xl font-bold text-gray-900">{itensArray.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-6">
              <p className="text-sm text-green-700 mb-1">Itens Certos</p>
              <p className="text-3xl font-bold text-green-800">{itensCertos.length}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-6">
              <p className="text-sm text-red-700 mb-1">Itens Errados</p>
              <p className="text-3xl font-bold text-red-800">{itensErrados.length}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <p className="text-sm text-blue-700 mb-1">Taxa de Acerto</p>
              <p className="text-3xl font-bold text-blue-800">
                {itensArray.length > 0 ? Math.round((itensCertos.length / itensArray.length) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Informações da Revisão */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Período: </span>
                <span className="font-medium text-gray-900">{mesNome} / {revisao.ano}</span>
              </div>
              <div>
                <span className="text-gray-600">Data: </span>
                <span className="font-medium text-gray-900">{new Date(revisao.data_fim).toLocaleDateString('pt-BR')}</span>
              </div>
              <div>
                <span className="text-gray-600">Usuário: </span>
                <span className="font-medium text-gray-900">{revisao.usuario}</span>
              </div>
            </div>
          </div>

          {/* Tabela de Resultados */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {filtroStatus === 'certo' 
                  ? 'Itens Certos'
                  : filtroStatus === 'errado'
                  ? 'Itens com Diferença'
                  : 'Todos os Itens Revisados'}
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
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantidade Sistema</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantidade Contada</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Diferença</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        Nenhum item encontrado
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item, index) => {
                      const diferenca = item.contado - item.sistema;
                      const diferencaTexto = diferenca > 0 ? `+${diferenca}` : diferenca.toString();
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{item.nome_item}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.sistema}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.contado}</td>
                          <td className={`px-6 py-4 text-sm font-medium ${
                            diferenca === 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {diferencaTexto}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              item.status === 'certo'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.status === 'certo' ? '✓ Certo' : '✖ Errado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Totais */}
            {itensFiltrados.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="text-gray-600">Total de registros: </span>
                    <span className="font-semibold text-gray-900">{itensFiltrados.length}</span>
                  </div>
                  {filtroStatus === 'todos' && (
                    <div className="flex gap-6">
                      <div>
                        <span className="text-gray-600">Itens certos: </span>
                        <span className="font-semibold text-green-700">{itensCertos.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Itens errados: </span>
                        <span className="font-semibold text-red-700">{itensErrados.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Diferença total: </span>
                        <span className="font-semibold text-gray-900">
                          {itensFiltrados.reduce((sum, item) => sum + (item.contado - item.sistema), 0) > 0 ? '+' : ''}
                          {itensFiltrados.reduce((sum, item) => sum + (item.contado - item.sistema), 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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

export default function ResumoPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Carregando...</p>
        </div>
      </ProtectedRoute>
    }>
      <ResumoContent />
    </Suspense>
  );
}

