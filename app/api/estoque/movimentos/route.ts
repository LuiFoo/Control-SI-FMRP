import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyToken, hasEstoqueEdicaoPermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

    // Qualquer usuário autenticado pode visualizar movimentações
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('movimentacoes');

    const movimentos = await collection
      .find({})
      .sort({ data: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ movimentos }, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar movimentos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

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

    // Verificar se tem permissão editarEstoque E login
    const hasPermission = await hasEstoqueEdicaoPermission(payload.userId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Você não possui permissão para adicionar ou remover itens do estoque.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tipo, itemId, quantidade, responsavel, setor, observacoes, data, numeroChamado } = body;

    if (!tipo || !itemId || !quantidade) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipo, itemId, quantidade' },
        { status: 400 }
      );
    }

    if (tipo !== 'entrada' && tipo !== 'saida') {
      return NextResponse.json(
        { error: 'Tipo deve ser "entrada" ou "saida"' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('fmrp');
    const estoqueCollection = db.collection('estoque');
    const movimentacoesCollection = db.collection('movimentacoes');

    // Buscar item do estoque
    const { ObjectId } = await import('mongodb');
    const item = await estoqueCollection.findOne({ _id: new ObjectId(itemId) });

    if (!item) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    // Atualizar quantidade no estoque
    const novaQuantidade = tipo === 'entrada' 
      ? (item.quantidade || 0) + quantidade
      : (item.quantidade || 0) - quantidade;

    if (novaQuantidade < 0) {
      return NextResponse.json(
        { error: 'Quantidade insuficiente no estoque' },
        { status: 400 }
      );
    }

    await estoqueCollection.updateOne(
      { _id: new ObjectId(itemId) },
      { $set: { quantidade: novaQuantidade } }
    );

    // Criar registro de movimentação
    // Usar a data fornecida ou a data atual
    const dataMovimento = data ? new Date(data) : new Date();
    
    const movimento = {
      tipo,
      itemId,
      itemNome: item.nome,
      quantidade,
      data: dataMovimento,
      responsavel: responsavel || null,
      setor: setor || null,
      observacoes: observacoes || null,
      numeroChamado: numeroChamado || null,
      usuarioId: payload.userId,
      usuarioNome: payload.username,
    };

    await movimentacoesCollection.insertOne(movimento);

    return NextResponse.json(
      { message: 'Movimentação registrada com sucesso', movimento },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao registrar movimentação:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

