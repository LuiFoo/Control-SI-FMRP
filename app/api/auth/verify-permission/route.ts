import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { isValidObjectId } from '@/lib/utils';
import { verifyLoginPermission } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
    }

    // Obter token para verificação adicional
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido', isAdmin: false, shouldLogout: true },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado', isAdmin: false, shouldLogout: true },
        { status: 401 }
      );
    }

    // Validar ObjectId
    if (!isValidObjectId(payload.userId)) {
      return NextResponse.json(
        { error: 'ID de usuário inválido', isAdmin: false, shouldLogout: true },
        { status: 400 }
      );
    }

    // Conectar ao MongoDB para atualizar data limite
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Verificar se o token do banco corresponde e se ainda está dentro do limite
    const user = await collection.findOne({ _id: new ObjectId(loginCheck.userId!) });
    
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
      { _id: new ObjectId(loginCheck.userId!) },
      {
        $set: {
          logout: dataLimite,
        }
      }
    );

    // Verificar permissões
    let isAdmin = false; // Administrador master
    let hasEditarEstoque = false;
    
    if (typeof user.permissao === 'object' && user.permissao !== null) {
      const permissao = user.permissao as { login?: boolean; editarEstoque?: boolean; isAdmin?: boolean };
      // Se for admin master, tem todas as permissões
      if (permissao.isAdmin === true) {
        isAdmin = true;
        hasEditarEstoque = true;
      } else {
        // Verificar permissões normais
        // Admin normal precisa ter ambas as permissões
        isAdmin = permissao.login === true && permissao.editarEstoque === true;
        hasEditarEstoque = permissao.editarEstoque === true;
      }
    } else if (typeof user.permissao === 'string') {
      // Compatibilidade com estrutura antiga
      isAdmin = user.permissao === 'admin';
      hasEditarEstoque = user.permissao === 'admin';
    }

    // Garantir estrutura de permissão
    let permissao = user.permissao;
    if (typeof permissao !== 'object' || permissao === null) {
      permissao = { login: false, editarEstoque: false, isAdmin: false };
    } else {
      // Garantir que isAdmin existe no objeto
      if (!('isAdmin' in permissao)) {
        permissao = { ...permissao, isAdmin: false };
      }
    }

    return NextResponse.json(
      { 
        valid: true,
        isAdmin: isAdmin,
        hasEditarEstoque: hasEditarEstoque,
        user: {
          id: loginCheck.userId!,
          username: loginCheck.username!,
          permissao: permissao,
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


