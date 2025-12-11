import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { isValidObjectId } from '@/lib/utils';

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
        { error: 'Token inválido ou expirado' },
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

    // Conectar ao MongoDB para atualizar data limite
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Verificar se o token do banco corresponde e se ainda está dentro do limite
    const user = await collection.findOne({ _id: new ObjectId(payload.userId) });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 401 }
      );
    }

    // Verificar se o token do banco corresponde
    if (user.token !== token) {
      return NextResponse.json(
        { error: 'Token não corresponde ao do banco' },
        { status: 401 }
      );
    }

    // Verificar se passou da data limite
    const agora = new Date();
    if (user.logout) {
      const dataLogout = new Date(user.logout);
      if (agora > dataLogout) {
        return NextResponse.json(
          { error: 'Token expirado (passou da data limite)' },
          { status: 401 }
        );
      }
    }

    // Calcular nova data limite: 2 horas a partir de agora
    const dataLimite = new Date(agora.getTime() + 2 * 60 * 60 * 1000); // 2 horas em milissegundos

    // Atualizar campo logout para 2 horas no futuro
    await collection.updateOne(
      { _id: new ObjectId(payload.userId) },
      {
        $set: {
          logout: dataLimite,
        }
      }
    );


    // Verificar se é admin
    // Como permissao no token é string JSON, precisamos verificar no banco
    let isAdmin = false;
    if (typeof user.permissao === 'object' && user.permissao !== null) {
      const permissao = user.permissao as { login?: boolean; editarEstoque?: boolean };
      isAdmin = permissao.login === true && permissao.editarEstoque === true;
    } else if (typeof user.permissao === 'string') {
      isAdmin = user.permissao === 'admin';
    }

    return NextResponse.json(
      { 
        valid: true,
        isAdmin: isAdmin,
        user: {
          id: payload.userId,
          username: payload.username,
          permissao: user.permissao || { login: false, editarEstoque: false },
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro na verificação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

