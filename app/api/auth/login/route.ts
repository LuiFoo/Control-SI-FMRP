import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getMongoClientWithRetry } from '@/lib/mongodb';
import { generateToken, validateEmail, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verificar se o body existe e é válido
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('Erro ao parsear JSON:', parseError);
      // Verificar se é erro de JSON vazio ou inválido
      if (parseError instanceof SyntaxError || parseError.message?.includes('JSON')) {
        return NextResponse.json(
          { error: 'Formato JSON inválido ou corpo da requisição vazio' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao processar requisição' },
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

    // Validar se é email @fmrp.usp.br
    if (!validateEmail(username)) {
      return NextResponse.json(
        { error: 'Email deve ser do domínio @fmrp.usp.br' },
        { status: 400 }
      );
    }

    // Conectar ao MongoDB com retry para WiFi instável
    let client;
    try {
      client = await getMongoClientWithRetry(5); // 5 tentativas para WiFi
    } catch (mongoError: any) {
      console.error('Falha ao conectar ao MongoDB:', mongoError?.message?.substring(0, 200));
      
      // Verificar tipo específico de erro
      const errorCode = mongoError?.cause?.code;
      const errorName = mongoError?.name;
      const errorMessage = mongoError?.message || '';
      
      if (errorCode === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR') {
        return NextResponse.json(
          { 
            error: 'Erro de conexão SSL/TLS com o banco de dados. Tente novamente em alguns segundos.',
            code: 'SSL_ERROR'
          },
          { status: 503 }
        );
      }
      
      // Verificar se é timeout (comum em WiFi)
      if (errorName === 'MongoServerSelectionError' || 
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND')) {
        return NextResponse.json(
          { 
            error: 'Timeout ao conectar com o banco de dados. Verifique sua conexão de rede e tente novamente.',
            code: 'TIMEOUT_ERROR'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Erro ao conectar com o banco de dados. Verifique sua conexão de rede e tente novamente.',
          code: 'CONNECTION_ERROR'
        },
        { status: 503 }
      );
    }
    
    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Buscar usuário
    const user = await collection.findOne({ username });

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // VERIFICAR PERMISSÃO ANTES DE VERIFICAR SENHA
    // Verificar se tem permissão de login
    let temPermissaoLogin = false;
    
    if (typeof user.permissao === 'object' && user.permissao !== null) {
      // Nova estrutura: permissao.login === true
      temPermissaoLogin = (user.permissao as any).login === true;
    } else if (typeof user.permissao === 'string') {
      // Estrutura antiga: permissao === 'admin' (compatibilidade)
      temPermissaoLogin = user.permissao === 'admin';
    }
    
    if (!temPermissaoLogin) {
      console.error('Permissão de login negada para:', username);
      return NextResponse.json(
        { error: 'Acesso negado. Você não tem permissão para fazer login no sistema.' },
        { status: 403 }
      );
    }

    // Verificar se o usuário tem passwordHash
    if (!user.passwordHash) {
      console.error('Usuário sem passwordHash:', user._id);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Verificar senha com bcrypt
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Verificar se precisa gerar novo token baseado no campo logout
    // O campo logout armazena o limite de validade do token (data/hora até quando o token é válido)
    const agora = new Date();
    let token: string = '';
    let precisaGerarNovoToken = false;

    // Verificar se existe campo logout e se passou da data/hora limite
    if (user.logout) {
      const dataLogout = new Date(user.logout);
      if (agora > dataLogout) {
        precisaGerarNovoToken = true;
      } else {
        // Verificar se existe token no banco e se é válido
        const tokenDoBanco = (user.token as string) || '';
        if (!tokenDoBanco) {
          precisaGerarNovoToken = true;
        } else {
          // Verificar se o token do banco ainda é válido (não expirado)
          const payloadToken = verifyToken(tokenDoBanco);
          if (!payloadToken) {
            precisaGerarNovoToken = true;
          } else {
            // Verificar se o token pertence ao mesmo usuário
            if (payloadToken.userId !== user._id.toString()) {
              precisaGerarNovoToken = true;
            } else {
              token = tokenDoBanco;
            }
          }
        }
      }
    } else {
      // Se não existe campo logout, é o primeiro login
      precisaGerarNovoToken = true;
    }

    // Gerar inicial do nome para usar como foto
    // Exemplo: luiz@fmrp.usp.br -> "L"
    const email = user.username.toLowerCase().trim();
    const nomeParte = email.split('@')[0]; // Pega a parte antes do @
    const inicial = nomeParte && nomeParte.length > 0 
      ? nomeParte[0].toUpperCase() 
      : '?'; // Fallback se não houver parte antes do @
    
    // Salvar inicial no banco (não precisa de URL, vamos usar a inicial diretamente)
    await collection.updateOne(
      { _id: user._id },
      { $set: { inicial: inicial } }
    );

    // Gerar novo token se necessário
    if (precisaGerarNovoToken) {
      // Converter permissao para string se for objeto
      let permissaoString = 'user';
      if (typeof user.permissao === 'object' && user.permissao !== null) {
        permissaoString = JSON.stringify(user.permissao);
      } else if (typeof user.permissao === 'string') {
        permissaoString = user.permissao;
      }
      
      token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        permissao: permissaoString,
      });
    }

    // Garantir que token foi definido
    if (!token) {
      console.error('❌ Erro: Token não foi gerado');
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Calcular data limite: 2 horas a partir de agora
    const dataLimite = new Date(agora.getTime() + 2 * 60 * 60 * 1000); // 2 horas em milissegundos

    // Atualizar no MongoDB: salvar token e atualizar campo logout para 2 horas no futuro
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          token: token,
          logout: dataLimite, // Data limite: 2 horas a partir de agora
        }
      }
    );

    // Criar resposta com token no JSON e no cookie
    const response = NextResponse.json(
      { 
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          permissao: user.permissao || { login: false, editarEstoque: false },
          inicial: inicial,
        }
      },
      { status: 200 }
    );

    // Configurar cookie HTTP-only com o token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

