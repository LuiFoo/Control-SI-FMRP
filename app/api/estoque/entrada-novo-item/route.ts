import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyToken, hasEstoqueEdicaoPermission } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Obter token do header Authorization ou cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar se tem permissão editarEstoque E login (necessário para criar novo item)
    const hasPermission = await hasEstoqueEdicaoPermission(payload.userId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Você não possui permissão para criar novos itens no estoque. É necessário ter permissão "editarEstoque" e "login".' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { nome, categoria, unidade, quantidade, quantidade_minima, observacoes } = body;

    // Validações
    if (!nome || !nome.trim()) {
      return NextResponse.json(
        { error: 'Nome do item é obrigatório' },
        { status: 400 }
      );
    }

    if (!categoria || !categoria.trim()) {
      return NextResponse.json(
        { error: 'Categoria é obrigatória para itens novos' },
        { status: 400 }
      );
    }

    if (!quantidade || quantidade <= 0) {
      return NextResponse.json(
        { error: 'Quantidade deve ser maior que zero' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('fmrp');
    const estoqueCollection = db.collection('estoque');
    const movimentacoesCollection = db.collection('movimentacoes');

    // Verificar se o item já existe (por segurança)
    const itemExistente = await estoqueCollection.findOne({
      nome: nome.trim(),
    });

    if (itemExistente) {
      return NextResponse.json(
        { error: 'Este item já existe no estoque. Use a entrada normal.' },
        { status: 400 }
      );
    }

    // Criar novo item
    const novoItem = {
      nome: nome.trim(),
      categoria: categoria.trim(),
      quantidade: quantidade,
      quantidade_minima: quantidade_minima !== undefined && quantidade_minima !== null ? Number(quantidade_minima) : 0,
      unidade: unidade || 'un',
      descricao: '',
      fornecedor: '',
      preco: 0,
      localizacao: '',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    const result = await estoqueCollection.insertOne(novoItem);
    const itemId = result.insertedId;

    // Registrar entrada
    const movimento = {
      tipo: 'entrada',
      itemId: itemId.toString(),
      itemNome: nome.trim(),
      quantidade: quantidade,
      data: new Date(),
      responsavel: null,
      setor: null,
      observacoes: observacoes || null,
      usuarioId: payload.userId,
      usuarioNome: payload.username,
    };

    await movimentacoesCollection.insertOne(movimento);

    return NextResponse.json(
      {
        success: true,
        message: 'Item criado e entrada registrada com sucesso.',
        item: {
          _id: itemId.toString(),
          ...novoItem,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar item e registrar entrada:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

