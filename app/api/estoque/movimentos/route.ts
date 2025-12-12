import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { isValidObjectId } from '@/lib/utils';
import { validateNumber, validateDate } from '@/lib/validations';
import { verifyLoginPermission, verifyEditarEstoquePermission } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
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

    // Converter ObjectId para string e garantir formato correto
    const movimentosFormatados = movimentos.map(mov => {
      // Converter itemId para string de forma segura
      let itemIdString: string | null = null;
      if (mov.itemId) {
        if (typeof mov.itemId === 'object' && 'toString' in mov.itemId) {
          itemIdString = mov.itemId.toString();
        } else if (typeof mov.itemId === 'string') {
          itemIdString = mov.itemId;
        }
      }
      
      return {
        ...mov,
        _id: mov._id.toString(),
        itemId: itemIdString,
        // Garantir que data seja serializada corretamente
        data: mov.data instanceof Date ? mov.data.toISOString() : mov.data,
      };
    });

    return NextResponse.json({ movimentos: movimentosFormatados }, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar movimentos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
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

    const { tipo, itemId, quantidade, quantidade_minima, responsavel, setor, observacoes, data, numeroChamado } = body;

    if (!tipo || !itemId || !quantidade) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipo, itemId, quantidade' },
        { status: 400 }
      );
    }

    // Validar ObjectId
    if (!isValidObjectId(itemId)) {
      return NextResponse.json(
        { error: 'ID do item inválido' },
        { status: 400 }
      );
    }

    if (tipo !== 'entrada' && tipo !== 'saida') {
      return NextResponse.json(
        { error: 'Tipo deve ser "entrada" ou "saida"' },
        { status: 400 }
      );
    }

    // Validar quantidade
    const quantidadeValidation = validateNumber(quantidade, 'Quantidade', 0, 1000000);
    if (!quantidadeValidation.valid) {
      return NextResponse.json(
        { error: quantidadeValidation.error },
        { status: 400 }
      );
    }
    const quantidadeValidada = quantidadeValidation.value!;

    // Verificar permissões baseado no tipo
    if (tipo === 'entrada') {
      // Para ENTRADA: precisa de editarEstoque: true E login: true (não desloga, apenas bloqueia)
      const hasPermission = await verifyEditarEstoquePermission(loginCheck.userId!);
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Você não possui permissão para adicionar itens ao estoque. É necessário ter permissão "editarEstoque" e "login".' },
          { status: 403 }
        );
      }
    }
    // Para SAÍDA: apenas precisa de login: true (já verificado acima)

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

    // Validar quantidade atual do item
    const quantidadeAtual = typeof item.quantidade === 'number' ? item.quantidade : 0;
    const quantidadeMinimaAtual = typeof item.quantidade_minima === 'number' ? item.quantidade_minima : undefined;
    
    // Atualizar quantidade no estoque
    const novaQuantidade = tipo === 'entrada' 
      ? quantidadeAtual + quantidadeValidada
      : quantidadeAtual - quantidadeValidada;

    if (novaQuantidade < 0) {
      return NextResponse.json(
        { error: 'Quantidade insuficiente no estoque' },
        { status: 400 }
      );
    }

    // Preparar atualização
    const updateData: { quantidade: number; quantidade_minima?: number } = { quantidade: novaQuantidade };
    
    // Se for entrada e foi fornecida quantidade_minima, atualizar também
    if (tipo === 'entrada' && quantidade_minima !== undefined && quantidade_minima !== null) {
      const qtdMinValidation = validateNumber(quantidade_minima, 'Quantidade mínima', 0, novaQuantidade);
      if (!qtdMinValidation.valid) {
        return NextResponse.json(
          { error: qtdMinValidation.error },
          { status: 400 }
        );
      }
      updateData.quantidade_minima = qtdMinValidation.value!;
    }

    // Validar e usar a data fornecida ou a data atual
    let dataMovimento: Date;
    if (data) {
      const dataValidation = validateDate(data, 'Data');
      if (!dataValidation.valid) {
        return NextResponse.json(
          { error: dataValidation.error },
          { status: 400 }
        );
      }
      dataMovimento = dataValidation.value!;
    } else {
      dataMovimento = new Date();
    }
    
    // Garantir que itemId seja ObjectId para consistência no banco
    const itemIdObjectId = new ObjectId(itemId);
    
    // Preparar movimento
    const movimento = {
      tipo,
      itemId: itemIdObjectId, // Salvar como ObjectId no banco
      itemNome: item.nome,
      quantidade: quantidadeValidada,
      data: dataMovimento,
      responsavel: responsavel || null,
      setor: setor || null,
      observacoes: observacoes || null,
      numeroChamado: numeroChamado || null,
      usuarioId: loginCheck.userId!,
      usuarioNome: loginCheck.username!,
    };

    // Atualizar estoque primeiro
    await estoqueCollection.updateOne(
      { _id: new ObjectId(itemId) },
      { $set: updateData }
    );

    // Criar registro de movimentação
    // NOTA: Se esta operação falhar, o estoque já foi atualizado.
    // Em produção, considere usar transações do MongoDB para garantir atomicidade.
    let result;
    try {
      result = await movimentacoesCollection.insertOne(movimento);
    } catch (movimentoError) {
      // Se falhar ao criar movimento, tentar reverter a atualização do estoque
      console.error('Erro ao criar movimento, tentando reverter atualização do estoque:', movimentoError);
      try {
        // Reverter quantidade e quantidade_minima para valores originais
        const revertData: { quantidade: number; quantidade_minima?: number } = { quantidade: quantidadeAtual };
        if (quantidadeMinimaAtual !== undefined) {
          revertData.quantidade_minima = quantidadeMinimaAtual;
        }
        await estoqueCollection.updateOne(
          { _id: new ObjectId(itemId) },
          { $set: revertData }
        );
      } catch (revertError) {
        console.error('Erro ao reverter atualização do estoque:', revertError);
      }
      return NextResponse.json(
        { error: 'Erro ao registrar movimentação. O estoque foi revertido.' },
        { status: 500 }
      );
    }

    // Retornar movimento com _id e itemId convertidos para string
    const movimentoRetornado = {
      ...movimento,
      _id: result.insertedId.toString(),
      itemId: itemIdObjectId.toString(), // Converter para string na resposta
      data: dataMovimento.toISOString(),
    };

    return NextResponse.json(
      { message: 'Movimentação registrada com sucesso', movimento: movimentoRetornado },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao registrar movimentação:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

