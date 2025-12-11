import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import clientPromise from '@/lib/mongodb';
import { validateEmail } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validação básica
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar se é email @fmrp.usp.br
    if (!validateEmail(username)) {
      return NextResponse.json(
        { error: 'Email deve ser do domínio @fmrp.usp.br' },
        { status: 400 }
      );
    }

    // Validar tamanho da senha
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    // Conectar ao MongoDB
    const client = await clientPromise;
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Verificar se usuário já existe
    const existingUser = await collection.findOne({ username });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      );
    }

    // Criptografar senha
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Inserir usuário com permissão padrão (objeto com login e editarEstoque false)
    const result = await collection.insertOne({
      username,
      passwordHash,
      permissao: {
        login: false,
        editarEstoque: false
      }, // Permissão padrão para novos usuários
    });

    return NextResponse.json(
      { 
        message: 'Usuário cadastrado com sucesso',
        userId: result.insertedId.toString(),
        username: username
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

