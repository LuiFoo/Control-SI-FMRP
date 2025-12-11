'use client';

import { useState, useEffect, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getToken } from '@/lib/auth-client';
import { useSearchParams, useRouter } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import jsPDF from 'jspdf';

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

function VisualizarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [loading, setLoading] = useState(true);

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
        // Revisão carregada com sucesso
        setRevisao(data.revisao);
      }
    } catch (error) {
      console.error('Erro ao carregar revisão:', error);
    } finally {
      setLoading(false);
    }
  };

  // Garantir que itens seja um array e filtrar corretamente
  const itensArray = Array.isArray(revisao?.itens) ? revisao.itens : [];
  const itensCertos = itensArray.filter(i => i && i.status === 'certo');
  const itensErrados = itensArray.filter(i => i && i.status === 'errado');

  const gerarPDF = (): jsPDF => {
    if (!revisao) throw new Error('Revisão não encontrada');

    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Revisão de Estoque', 105, 20, { align: 'center' });

    // Informações
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const mesNome = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][revisao.mes - 1];
    doc.text(`Mês/Ano: ${mesNome}/${revisao.ano}`, 20, 35);
    doc.text(`Data: ${new Date(revisao.data_fim).toLocaleDateString('pt-BR')}`, 20, 42);
    doc.text(`Usuário: ${revisao.usuario}`, 20, 49);
    doc.text(`Total de itens: ${revisao.itens?.length || 0}`, 20, 56);
    doc.text(`Itens certos: ${itensCertos.length}`, 100, 56);
    doc.text(`Itens errados: ${itensErrados.length}`, 150, 56);

    // Itens Certos
    let y = 70;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens Certos', 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    itensCertos.slice(0, 20).forEach((item) => {
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      doc.text(`✓ ${item.nome_item} — ${item.sistema}/${item.contado}`, 25, y);
      y += 7;
    });

    // Itens Errados
    y += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens Errados', 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    itensErrados.forEach((item) => {
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      doc.text(`✖ ${item.nome_item} — sistema: ${item.sistema} / contado: ${item.contado}`, 25, y);
      y += 7;
    });

    return doc;
  };

  const exportarPDF = () => {
    if (!revisao) return;
    const doc = gerarPDF();
    doc.save(`revisao-estoque-${revisao.mes}-${revisao.ano}.pdf`);
  };

  const imprimir = () => {
    if (!revisao) return;
    const doc = gerarPDF();
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Revisão de Estoque</h1>
            <p className="text-sm text-gray-500">
              {mesNome} / {revisao.ano} • {new Date(revisao.data_fim).toLocaleDateString('pt-BR')} • {revisao.usuario}
            </p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          </div>

          {/* Itens Certos */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              ✓ Itens Certos ({itensCertos.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {itensCertos.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum item correto.</p>
              ) : (
                itensCertos.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm text-gray-900">{item.nome_item}</span>
                    <span className="text-sm font-medium text-green-700">
                      {item.sistema} / {item.contado}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Itens Errados */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              ✖ Itens Errados ({itensErrados.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {itensErrados.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum item com diferença.</p>
              ) : (
                itensErrados.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <span className="text-sm text-gray-900">{item.nome_item}</span>
                    <span className="text-sm font-medium text-red-700">
                      sistema: {item.sistema} / contado: {item.contado}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4">
            <button
              onClick={exportarPDF}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              PDF
            </button>
            <button
              onClick={imprimir}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Imprimir
            </button>
            <button
              onClick={() => router.push('/estoque/verificacao/historico')}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Voltar ao Histórico
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

