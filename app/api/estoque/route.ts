import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken, hasEstoqueEdicaoPermission } from '@/lib/auth';

// GET - Listar todos os itens de estoque
export async function GET(request: NextRequest) {
  try {
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

    // Buscar todos os itens de estoque
    const itens = await collection.find({}).sort({ nome: 1 }).toArray();

    return NextResponse.json(
      { itens },
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

    const body = await request.json();
    const { nome, descricao, quantidade, unidade, categoria, fornecedor, preco, localizacao } = body;

    // Validações
    if (!nome || !quantidade) {
      return NextResponse.json(
        { error: 'Nome e quantidade são obrigatórios' },
        { status: 400 }
      );
    }

    if (typeof quantidade !== 'number' || quantidade < 0) {
      return NextResponse.json(
        { error: 'Quantidade deve ser um número positivo' },
        { status: 400 }
      );
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('estoque');

    // Verificar se já existe item com o mesmo nome
    const itemExistente = await collection.findOne({ nome: nome.trim() });
    if (itemExistente) {
      return NextResponse.json(
        { error: 'Já existe um item com este nome' },
        { status: 400 }
      );
    }

    // Criar novo item
    const novoItem = {
      nome: nome.trim(),
      descricao: descricao?.trim() || '',
      quantidade: quantidade,
      unidade: unidade || 'un',
      categoria: categoria?.trim() || '',
      fornecedor: fornecedor?.trim() || '',
      preco: preco || 0,
      localizacao: localizacao?.trim() || '',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    const result = await collection.insertOne(novoItem);

    return NextResponse.json(
      { 
        message: 'Item criado com sucesso',
        item: { ...novoItem, _id: result.insertedId }
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

