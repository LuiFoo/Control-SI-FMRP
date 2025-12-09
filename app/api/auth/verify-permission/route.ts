import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Obter token do header Authorization ou cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido', isAdmin: false },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado', isAdmin: false },
        { status: 401 }
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
        { error: 'Usuário não encontrado', isAdmin: false },
        { status: 401 }
      );
    }

    // Verificar se o token do banco corresponde
    if (user.token !== token) {
      return NextResponse.json(
        { error: 'Token não corresponde ao do banco', isAdmin: false },
        { status: 401 }
      );
    }

    // Obter data atual
    const agora = new Date();

    // Verificar se passou da data limite
    if (user.logout) {
      const dataLogout = new Date(user.logout);
      if (agora > dataLogout) {
        return NextResponse.json(
          { error: 'Token expirado (passou da data limite)', isAdmin: false },
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

    console.log('✅ Permissão verificada e data limite atualizada para usuário:', payload.username);

    // Verificar se é admin
    const isAdmin = payload.permissao === 'admin';

    return NextResponse.json(
      { 
        valid: true,
        isAdmin: isAdmin,
        user: {
          id: payload.userId,
          username: payload.username,
          permissao: payload.permissao,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro na verificação de permissão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', isAdmin: false },
      { status: 500 }
    );
  }
}


