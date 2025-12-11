import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não está definido nas variáveis de ambiente. Configure JWT_SECRET no arquivo .env.local');
}

// Type assertion: após a verificação acima, JWT_SECRET é garantidamente uma string
const JWT_SECRET_STRING: string = JWT_SECRET;

export interface TokenPayload {
  userId: string;
  username: string;
  permissao: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET_STRING, {
    expiresIn: '7d', // Token expira em 7 dias
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_STRING) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@fmrp\.usp\.br$/;
  return emailRegex.test(email);
}

/**
 * Verifica se o payload do token tem permissão de admin
 * NOTA: Esta função está obsoleta. Use hasEstoqueEdicaoPermission() que verifica no banco.
 * Mantida apenas para compatibilidade.
 */
export function isAdmin(payload: TokenPayload | null): boolean {
  if (!payload || !payload.permissao) return false;
  
  // Se permissao é string JSON, tentar fazer parse
  try {
    if (typeof payload.permissao === 'string') {
      const permissaoObj = JSON.parse(payload.permissao);
      if (typeof permissaoObj === 'object' && permissaoObj !== null) {
        return permissaoObj.login === true && permissaoObj.editarEstoque === true;
      }
      // Se não for JSON válido, verificar se é string 'admin' (compatibilidade)
      return payload.permissao === 'admin';
    }
  } catch (error) {
    // Se não for JSON, verificar se é string 'admin' (compatibilidade)
    if (typeof payload.permissao === 'string') {
      return payload.permissao === 'admin';
    }
  }
  
  return false;
}

/**
 * Verifica se o usuário tem permissão de login
 * Busca no banco de dados para verificar a estrutura completa de permissões
 */
export async function hasLoginPermission(userId: string): Promise<boolean> {
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
    
    // Verificar se permissao é um objeto
    if (typeof user.permissao === 'object' && user.permissao !== null) {
      const permissao = user.permissao as { login?: boolean; isAdmin?: boolean };
      // Se for admin master, tem permissão de login
      if (permissao.isAdmin === true) {
        return true;
      }
      // Verificar se tem login === true
      return permissao.login === true;
    }
    
    // Se permissao é string, verificar se é admin (compatibilidade com versão antiga)
    if (typeof user.permissao === 'string') {
      return user.permissao === 'admin';
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar permissão login:', error);
    return false;
  }
}

/**
 * Verifica se o usuário tem permissão de editarEstoque E login
 * Busca no banco de dados para verificar a estrutura completa de permissões
 */
export async function hasEstoqueEdicaoPermission(userId: string): Promise<boolean> {
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
    
    // Verificar se permissao é um objeto
    if (typeof user.permissao === 'object' && user.permissao !== null) {
      const permissao = user.permissao as { login?: boolean; editarEstoque?: boolean; isAdmin?: boolean };
      // Se for admin master, tem todas as permissões
      if (permissao.isAdmin === true) {
        return true;
      }
      // Verificar se tem editarEstoque === true E login === true
      const hasEditarEstoque = permissao.editarEstoque === true;
      const hasLogin = permissao.login === true;
      
      // Precisa ter AMBOS: editarEstoque E login
      return hasEditarEstoque && hasLogin;
    }
    
    // Se permissao é string, verificar se é admin (compatibilidade com versão antiga)
    if (typeof user.permissao === 'string') {
      return user.permissao === 'admin';
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar permissão editarEstoque:', error);
    return false;
  }
}

