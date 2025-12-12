import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { validateStringLength, validateNumber } from '@/lib/validations';
import { verifyLoginPermission, verifyEditarEstoquePermission } from '@/lib/auth-middleware';

// GET - Listar todos os itens de estoque
export async function GET(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
    }

    // Qualquer usuário autenticado pode visualizar itens do estoque
    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('estoque');

    // Buscar todos os itens de estoque
    const itens = await collection.find({}).sort({ nome: 1 }).toArray();

    // Converter ObjectId para string e formatar datas
    const itensFormatados = itens.map(item => ({
      ...item,
      _id: item._id.toString(),
      criadoEm: item.criadoEm instanceof Date ? item.criadoEm.toISOString() : item.criadoEm,
      atualizadoEm: item.atualizadoEm instanceof Date ? item.atualizadoEm.toISOString() : item.atualizadoEm,
    }));

    return NextResponse.json(
      { itens: itensFormatados },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao listar estoque:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo item de estoque
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
        { error: 'Você não possui permissão para adicionar ou remover itens do estoque.' },
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

    const { nome, descricao, quantidade, unidade, categoria, fornecedor, preco, localizacao, quantidade_minima } = body;

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

    // Validações
    const nomeValidation = validateStringLength(nome, 'Nome', 1, 200);
    if (!nomeValidation.valid) {
      return NextResponse.json(
        { error: nomeValidation.error },
        { status: 400 }
      );
    }

    const quantidadeValidation = validateNumber(quantidade, 'Quantidade', 0, 1000000);
    if (!quantidadeValidation.valid) {
      return NextResponse.json(
        { error: quantidadeValidation.error },
        { status: 400 }
      );
    }

    // Validar outros campos opcionais
    if (descricao) {
      const descValidation = validateStringLength(descricao, 'Descrição', 0, 1000);
      if (!descValidation.valid) {
        return NextResponse.json(
          { error: descValidation.error },
          { status: 400 }
        );
      }
    }

    if (categoria) {
      const catValidation = validateStringLength(categoria, 'Categoria', 0, 100);
      if (!catValidation.valid) {
        return NextResponse.json(
          { error: catValidation.error },
          { status: 400 }
        );
      }
    }

    if (fornecedor) {
      const fornValidation = validateStringLength(fornecedor, 'Fornecedor', 0, 200);
      if (!fornValidation.valid) {
        return NextResponse.json(
          { error: fornValidation.error },
          { status: 400 }
        );
      }
    }

    if (localizacao) {
      const locValidation = validateStringLength(localizacao, 'Localização', 0, 200);
      if (!locValidation.valid) {
        return NextResponse.json(
          { error: locValidation.error },
          { status: 400 }
        );
      }
    }

    // Validar preço se fornecido
    let precoValidado = 0;
    if (preco !== undefined && preco !== null) {
      const precoValidation = validateNumber(preco, 'Preço', 0, 999999999.99);
      if (!precoValidation.valid) {
        return NextResponse.json(
          { error: precoValidation.error },
          { status: 400 }
        );
      }
      precoValidado = precoValidation.value!;
    }

    // Validar quantidade mínima se fornecida
    if (quantidade_minima !== undefined && quantidade_minima !== null) {
      const qtdMinValidation = validateNumber(quantidade_minima, 'Quantidade mínima', 0, quantidadeValidation.value!);
      if (!qtdMinValidation.valid) {
        return NextResponse.json(
          { error: qtdMinValidation.error },
          { status: 400 }
        );
      }
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('estoque');

    const nomeTrimmed = nome.trim();
    
    // Verificar se já existe item com o mesmo nome
    const itemExistente = await collection.findOne({ nome: nomeTrimmed });
    if (itemExistente) {
      return NextResponse.json(
        { error: 'Já existe um item com este nome' },
        { status: 400 }
      );
    }

    // Validar quantidade mínima
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

    // Criar novo item
    const novoItem = {
      nome: nomeTrimmed,
      descricao: descricao?.trim() || '',
      quantidade: quantidadeValidation.value!,
      quantidade_minima: qtdMinima,
      unidade: (unidade || 'un').trim(),
      categoria: categoria?.trim() || '',
      fornecedor: fornecedor?.trim() || '',
      preco: precoValidado,
      localizacao: localizacao?.trim() || '',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    const result = await collection.insertOne(novoItem);

    return NextResponse.json(
      { 
        message: 'Item criado com sucesso',
        item: { 
          ...novoItem, 
          _id: result.insertedId.toString(),
          criadoEm: novoItem.criadoEm.toISOString(),
          atualizadoEm: novoItem.atualizadoEm.toISOString(),
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar item de estoque:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

