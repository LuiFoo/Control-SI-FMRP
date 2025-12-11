import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { isValidObjectId } from '@/lib/utils';

// GET - Buscar dados do usuário logado (incluindo foto)
export async function GET(request: NextRequest) {
  try {
    // Obter token do header Authorization ou cookie
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

    // Validar ObjectId
    if (!isValidObjectId(payload.userId)) {
      return NextResponse.json(
        { error: 'ID de usuário inválido' },
        { status: 400 }
      );
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Buscar usuário
    const user = await collection.findOne({ _id: new ObjectId(payload.userId) });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Garantir que username existe
    if (!user.username) {
      console.error('Usuário sem username:', user._id);
      return NextResponse.json(
        { error: 'Dados do usuário incompletos' },
        { status: 500 }
      );
    }

    // Gerar inicial do nome se não tiver
    let inicial = user.inicial;
    if (!inicial && user.username) {
      const email = user.username.toLowerCase().trim();
      const nomeParte = email.split('@')[0];
      if (nomeParte && nomeParte.length > 0) {
        inicial = nomeParte[0].toUpperCase();
        // Salvar inicial no banco para próxima vez
        await collection.updateOne(
          { _id: user._id },
          { $set: { inicial: inicial } }
        );
      }
    }

    return NextResponse.json(
      { 
        user: {
          id: user._id.toString(),
          username: user.username,
          permissao: user.permissao || { login: false, editarEstoque: false },
          inicial: inicial || user.username[0]?.toUpperCase() || '?',
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

