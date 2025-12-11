import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import clientPromise from '@/lib/mongodb';
import { validateEmail } from '@/lib/auth';
import { validatePassword, validateEmailLength } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      );
    }

    const { username, password } = body;

    // Validação básica
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar tamanho do email
    const emailValidation = validateEmailLength(username);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
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

    // Validar senha
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
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

    // Inserir usuário com permissão padrão (objeto com login, editarEstoque e isAdmin false)
    const result = await collection.insertOne({
      username,
      passwordHash,
      permissao: {
        login: false,
        editarEstoque: false,
        isAdmin: false // Administrador master (apenas alguns usuários terão true)
      }, // Permissão padrão para novos usuários (todas false)
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

