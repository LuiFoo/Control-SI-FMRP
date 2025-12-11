import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { isValidObjectId } from '@/lib/utils';

export async function POST(request: NextRequest) {
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

    // Verificar token
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

    // Atualizar campo logout para agora (invalidando o token imediatamente)
    const agora = new Date();
    await collection.updateOne(
      { _id: new ObjectId(payload.userId) },
      {
        $set: {
          logout: agora, // Define para agora, invalidando o token
        }
      }
    );

    // Logout realizado com sucesso

    // Criar resposta e remover cookie
    const response = NextResponse.json(
      { message: 'Logout realizado com sucesso' },
      { status: 200 }
    );

    // Remover cookie
    response.cookies.delete('token');

    return response;
  } catch (error) {
    console.error('Erro no logout:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

