import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken, hasEstoqueEdicaoPermission } from '@/lib/auth';
import { isValidObjectId } from '@/lib/utils';
import { validateStringLength, validateNumber } from '@/lib/validations';

// GET - Buscar item específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Qualquer usuário autenticado pode visualizar itens do estoque
    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('estoque');

    // Buscar item
    const item = await collection.findOne({ _id: new ObjectId(id) });

    if (!item) {
      return NextResponse.json(
        { error: 'Item não encontrado' },
        { status: 404 }
      );
    }

    // Converter ObjectId para string e formatar datas
    const itemFormatado = {
      ...item,
      _id: item._id.toString(),
      criadoEm: item.criadoEm instanceof Date ? item.criadoEm.toISOString() : item.criadoEm,
      atualizadoEm: item.atualizadoEm instanceof Date ? item.atualizadoEm.toISOString() : item.atualizadoEm,
    };

    return NextResponse.json(
      { item: itemFormatado },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao buscar item:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar se tem permissão editarEstoque E login
    const hasPermission = await hasEstoqueEdicaoPermission(payload.userId);
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

    if (preco !== undefined && preco !== null) {
      const precoValidation = validateNumber(preco, 'Preço', 0, 999999999.99);
      if (!precoValidation.valid) {
        return NextResponse.json(
          { error: precoValidation.error },
          { status: 400 }
        );
      }
    }

    // Validar quantidade mínima se fornecida
    let qtdMinima = undefined;
    if (quantidade_minima !== undefined && quantidade_minima !== null) {
      const qtdMinValidation = validateNumber(quantidade_minima, 'Quantidade mínima', 0, quantidadeValidation.value!);
      if (!qtdMinValidation.valid) {
        return NextResponse.json(
          { error: qtdMinValidation.error },
          { status: 400 }
        );
      }
      qtdMinima = qtdMinValidation.value;
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('estoque');

    // Verificar se item existe
    const itemExistente = await collection.findOne({ _id: new ObjectId(id) });
    if (!itemExistente) {
      return NextResponse.json(
        { error: 'Item não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se nome já existe em outro item
    const itemComMesmoNome = await collection.findOne({ 
      nome: nome.trim(),
      _id: { $ne: new ObjectId(id) }
    });
    if (itemComMesmoNome) {
      return NextResponse.json(
        { error: 'Já existe outro item com este nome' },
        { status: 400 }
      );
    }

    // Atualizar item
    const atualizacao: {
      nome: string;
      descricao: string;
      quantidade: number;
      unidade: string;
      categoria: string;
      fornecedor: string;
      preco: number;
      localizacao: string;
      atualizadoEm: Date;
      quantidade_minima?: number;
    } = {
      nome: nome.trim(),
      descricao: descricao?.trim() || '',
      quantidade: quantidadeValidation.value!,
      unidade: unidade || 'un',
      categoria: categoria?.trim() || '',
      fornecedor: fornecedor?.trim() || '',
      preco: preco !== undefined && preco !== null ? Number(preco) : 0,
      localizacao: localizacao?.trim() || '',
      atualizadoEm: new Date(),
    };

    // Incluir quantidade_minima se fornecida
    if (qtdMinima !== undefined) {
      atualizacao.quantidade_minima = qtdMinima;
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: atualizacao }
    );

    // Buscar item atualizado para retornar
    const itemAtualizado = await collection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json(
      { 
        message: 'Item atualizado com sucesso',
        item: itemAtualizado ? {
          ...itemAtualizado,
          _id: itemAtualizado._id.toString(),
          criadoEm: itemAtualizado.criadoEm instanceof Date ? itemAtualizado.criadoEm.toISOString() : itemAtualizado.criadoEm,
          atualizadoEm: itemAtualizado.atualizadoEm instanceof Date ? itemAtualizado.atualizadoEm.toISOString() : itemAtualizado.atualizadoEm,
        } : { ...atualizacao, _id: id }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar se tem permissão editarEstoque E login
    const hasPermission = await hasEstoqueEdicaoPermission(payload.userId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Você não possui permissão para adicionar ou remover itens do estoque.' },
        { status: 403 }
      );
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('estoque');

    // Verificar se item existe
    const item = await collection.findOne({ _id: new ObjectId(id) });
    if (!item) {
      return NextResponse.json(
        { error: 'Item não encontrado' },
        { status: 404 }
      );
    }

    // Deletar item
    await collection.deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json(
      { message: 'Item deletado com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao deletar item:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

