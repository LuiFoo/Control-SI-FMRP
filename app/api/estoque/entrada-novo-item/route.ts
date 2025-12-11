import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { validateStringLength, validateNumber } from '@/lib/validations';
import { verifyLoginPermission, verifyEditarEstoquePermission } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
    }

    // Verificar se tem permissão editarEstoque (não desloga, apenas bloqueia)
    const hasPermission = await verifyEditarEstoquePermission(loginCheck.userId!);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Você não possui permissão para criar novos itens no estoque. É necessário ter permissão "editarEstoque" e "login".' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    const { nome, categoria, unidade, quantidade, quantidade_minima, observacoes } = body;

    // Validações
    const nomeValidation = validateStringLength(nome, 'Nome', 1, 200);
    if (!nomeValidation.valid) {
      return NextResponse.json(
        { error: nomeValidation.error },
        { status: 400 }
      );
    }

    const categoriaValidation = validateStringLength(categoria, 'Categoria', 1, 100);
    if (!categoriaValidation.valid) {
      return NextResponse.json(
        { error: categoriaValidation.error },
        { status: 400 }
      );
    }

    // Validar unidade se fornecida
    if (unidade) {
      const unidadeValidation = validateStringLength(unidade, 'Unidade', 1, 20);
      if (!unidadeValidation.valid) {
        return NextResponse.json(
          { error: unidadeValidation.error },
          { status: 400 }
        );
      }
    }

    const quantidadeValidation = validateNumber(quantidade, 'Quantidade', 0, 1000000, false);
    if (!quantidadeValidation.valid) {
      return NextResponse.json(
        { error: quantidadeValidation.error },
        { status: 400 }
      );
    }

    // Validar quantidade mínima se fornecida
    let qtdMinima = 0;
    if (quantidade_minima !== undefined && quantidade_minima !== null) {
      const qtdMinValidation = validateNumber(quantidade_minima, 'Quantidade mínima', 0, quantidadeValidation.value!);
      if (!qtdMinValidation.valid) {
        return NextResponse.json(
          { error: qtdMinValidation.error },
          { status: 400 }
        );
      }
      qtdMinima = qtdMinValidation.value!;
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

    // Criar novo item - usar valor validado
    const novoItem = {
      nome: nome.trim(),
      categoria: categoria.trim(),
      quantidade: quantidadeValidation.value!, // Usar valor validado
      quantidade_minima: qtdMinima,
      unidade: (unidade || 'un').trim(),
      descricao: '',
      fornecedor: '',
      preco: 0,
      localizacao: '',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    const result = await estoqueCollection.insertOne(novoItem);
    const itemId = result.insertedId;

    // Registrar entrada - usar ObjectId para consistência
    const { ObjectId } = await import('mongodb');
    const movimento = {
      tipo: 'entrada',
      itemId: itemId, // Salvar como ObjectId no banco
      itemNome: nome.trim(),
      quantidade: quantidadeValidation.value!, // Usar valor validado
      data: new Date(),
      responsavel: null,
      setor: null,
      observacoes: observacoes || null,
      usuarioId: loginCheck.userId!,
      usuarioNome: loginCheck.username!,
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

