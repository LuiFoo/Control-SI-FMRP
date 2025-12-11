import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { isValidObjectId } from '@/lib/utils';
import { verifyLoginPermission } from '@/lib/auth-middleware';

// GET - Buscar dados do usuário logado (incluindo foto)
export async function GET(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Buscar usuário
    const user = await collection.findOne({ _id: new ObjectId(loginCheck.userId!) });

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
        // Salvar inicial no banco para próxima vez (async, não bloquear resposta)
        collection.updateOne(
          { _id: user._id },
          { $set: { inicial: inicial } }
        ).catch(err => {
          console.error('Erro ao salvar inicial:', err);
          // Não falhar a requisição se não conseguir salvar inicial
        });
      } else {
        // Fallback se não houver parte antes do @
        inicial = '?';
      }
    }
    
    // Garantir que inicial sempre tenha um valor válido
    if (!inicial || inicial.trim() === '') {
      if (user.username && user.username.length > 0) {
        inicial = user.username[0].toUpperCase();
      } else {
        inicial = '?';
      }
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
        user: {
          id: user._id.toString(),
          username: user.username,
          permissao: permissao,
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

