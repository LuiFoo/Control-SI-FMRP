import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { isValidObjectId } from './utils';

/**
 * Middleware para verificar se o usuário tem permissão de login
 * Se não tiver, retorna erro 403 que deve ser tratado no frontend para deslogar
 */
export async function verifyLoginPermission(request: NextRequest): Promise<{
  valid: boolean;
  response?: NextResponse;
  userId?: string;
  username?: string;
}> {
  try {
    // Obter token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Token não fornecido', shouldLogout: true },
          { status: 401 }
        )
      };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Token inválido', shouldLogout: true },
          { status: 401 }
        )
      };
    }

    // Validar ObjectId
    if (!isValidObjectId(payload.userId)) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'ID de usuário inválido', shouldLogout: true },
          { status: 400 }
        )
      };
    }

    // Buscar usuário no banco para verificar permissão de login
    const { default: clientPromise } = await import('@/lib/mongodb');
    const { ObjectId } = await import('mongodb');
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    const user = await collection.findOne({ _id: new ObjectId(payload.userId) });

    if (!user) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Usuário não encontrado', shouldLogout: true },
          { status: 404 }
        )
      };
    }

    // Verificar permissão de login
    // DESLOGAR se login !== true (ou seja, se for false, undefined, ou qualquer outro valor)
    let temPermissaoLogin = false;

    if (typeof user.permissao === 'object' && user.permissao !== null) {
      const permissao = user.permissao as { login?: boolean; isAdmin?: boolean };
      // Se for admin master, tem permissão de login automaticamente
      if (permissao.isAdmin === true) {
        temPermissaoLogin = true;
      } else {
        // Verificar se login === true (desloga se for false, undefined, ou qualquer outro valor)
        temPermissaoLogin = permissao.login === true;
      }
    } else if (typeof user.permissao === 'string') {
      // Compatibilidade com estrutura antiga
      temPermissaoLogin = user.permissao === 'admin';
    }

    // Se login !== true, deslogar automaticamente
    if (!temPermissaoLogin) {
      // Usuário não tem permissão de login - DESLOGAR AUTOMATICAMENTE
      // Invalidar token no banco de dados
      const agora = new Date();
      await collection.updateOne(
        { _id: new ObjectId(payload.userId) },
        {
          $set: {
            logout: agora, // Define para agora, invalidando o token imediatamente
          }
        }
      );

      // Criar resposta com cookie removido
      const response = NextResponse.json(
        { 
          error: 'Você não possui permissão para acessar o sistema. Faça login novamente.',
          shouldLogout: true 
        },
        { status: 403 }
      );
      
      // Remover cookie de token
      response.cookies.delete('token');
      
      return {
        valid: false,
        response: response
      };
    }

    return {
      valid: true,
      userId: payload.userId,
      username: payload.username,
    };
  } catch (error) {
    console.error('Erro ao verificar permissão de login:', error);
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Erro ao verificar permissão', shouldLogout: true },
        { status: 500 }
      )
    };
  }
}

/**
 * Verifica permissão de editarEstoque (não desloga, apenas bloqueia ação)
 */
export async function verifyEditarEstoquePermission(userId: string): Promise<boolean> {
  try {
    const { default: clientPromise } = await import('@/lib/mongodb');
    const { ObjectId } = await import('mongodb');
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    const user = await collection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return false;
    }

    if (typeof user.permissao === 'object' && user.permissao !== null) {
      const permissao = user.permissao as { login?: boolean; editarEstoque?: boolean; isAdmin?: boolean };
      // Se for admin master, tem todas as permissões
      if (permissao.isAdmin === true) {
        return true;
      }
      // Precisa ter editarEstoque === true E login === true
      return permissao.editarEstoque === true && permissao.login === true;
    }

    if (typeof user.permissao === 'string') {
      return user.permissao === 'admin';
    }

    return false;
  } catch (error) {
    console.error('Erro ao verificar permissão editarEstoque:', error);
    return false;
  }
}

