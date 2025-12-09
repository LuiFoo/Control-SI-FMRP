import { MongoClient, type ServerMonitoringMode } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Por favor, adicione a variável MONGODB_URI no arquivo .env.local');
}

// Função para preparar a URI com configurações TLS em desenvolvimento
function prepareMongoURI(originalUri: string): string {
  let uri = originalUri;
  
  // Em desenvolvimento, sempre adicionar parâmetros TLS diretamente na URI
  // Isso garante que os parâmetros sejam aplicados mesmo se houver conflitos com options
  if (process.env.NODE_ENV === 'development') {
    const separator = uri.includes('?') ? '&' : '?';
    const params: string[] = [];
    
    // CRÍTICO: Para resolver problemas SSL no WiFi, adicionar TODOS os parâmetros necessários
    if (!uri.includes('tlsAllowInvalidCertificates')) {
      params.push('tlsAllowInvalidCertificates=true');
    }
    
    // Para mongodb+srv, sempre adicionar tls=true explicitamente
    if (uri.startsWith('mongodb+srv://') && !uri.includes('tls=')) {
      params.push('tls=true');
    }
    
    // Adicionar diretConnection=false para permitir que o driver gerencie a conexão
    if (!uri.includes('directConnection')) {
      params.push('directConnection=false');
    }
    
    // Adicionar retryWrites também na URI para garantir
    if (!uri.includes('retryWrites')) {
      params.push('retryWrites=true');
    }
    
    // Adicionar serverSelectionTimeoutMS na URI também
    if (!uri.includes('serverSelectionTimeoutMS')) {
      params.push('serverSelectionTimeoutMS=45000');
    }
    
    if (params.length > 0) {
      uri = `${uri}${separator}${params.join('&')}`;
    }
  }
  
  return uri;
}

const originalUri = process.env.MONGODB_URI;
const uri = prepareMongoURI(originalUri);

// Configurações do MongoDB
const options: {
  maxPoolSize?: number;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  connectTimeoutMS?: number;
  retryWrites?: boolean;
  retryReads?: boolean;
  heartbeatFrequencyMS?: number;
  serverMonitoringMode?: ServerMonitoringMode;
  tls?: boolean;
  tlsAllowInvalidCertificates?: boolean;
} = {
  maxPoolSize: 10,
  // Aumentar timeouts para WiFi (que pode ter latência maior)
  // Timeouts maiores para WiFi instável
  serverSelectionTimeoutMS: 45000, // 45 segundos (aumentado para WiFi)
  socketTimeoutMS: 90000, // 90 segundos (aumentado para WiFi)
  connectTimeoutMS: 45000, // 45 segundos (aumentado para WiFi)
  // Habilitar retry automático
  retryWrites: true,
  retryReads: true,
  // Configurações de heartbeat para manter conexão ativa
  heartbeatFrequencyMS: 10000, // Verificar conexão a cada 10 segundos
  serverMonitoringMode: 'auto',
  // Configurações TLS/SSL para resolver erros de handshake no Windows/WiFi
  // Em desenvolvimento, sempre permitir certificados inválidos
  // ATENÇÃO: Não use tlsAllowInvalidCertificates em produção por questões de segurança
  ...(process.env.NODE_ENV === 'development' && { 
    tls: true, // Forçar TLS explicitamente
    tlsAllowInvalidCertificates: true, // Permitir certificados inválidos (CRÍTICO para WiFi)
  }),
};

// Função para criar uma nova conexão MongoDB
function createMongoConnection(): Promise<MongoClient> {
  const client = new MongoClient(uri, options);
  return client.connect();
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // Em desenvolvimento, use uma variável global para evitar múltiplas conexões
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = createMongoConnection();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // Em produção, sempre crie um novo cliente
  clientPromise = createMongoConnection();
}

export default clientPromise;

/**
 * Função helper para obter cliente MongoDB com retry automático
 * Útil para conexões WiFi instáveis que podem ter timeouts
 */
export async function getMongoClientWithRetry(maxRetries: number = 3): Promise<MongoClient> {
  let lastError: any = null;
  let actualMaxRetries = maxRetries;
  let hasSSLError = false;
  
  for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
    // Criar nova conexão em cada tentativa para evitar promises travadas
    const connectionPromise = createMongoConnection();
    
    // Atualizar cache global em desenvolvimento
    if (process.env.NODE_ENV === 'development' && typeof global !== 'undefined') {
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };
      globalWithMongo._mongoClientPromise = connectionPromise;
    }
    
    try {
      // Timeout para detectar conexões travadas
      const connectionTimeout = attempt <= 2 ? 20000 : 30000; // 20s primeiras, 30s outras
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout: Conexão MongoDB travada após ${connectionTimeout}ms`));
        }, connectionTimeout);
      });
      
      // Usar Promise.race para detectar timeout
      const client = await Promise.race([connectionPromise, timeoutPromise]);
      
      // Testar se a conexão está realmente funcionando
      await client.db('admin').command({ ping: 1 });
      return client;
    } catch (error: any) {
      lastError = error;
      const errorCode = error?.cause?.code;
      const errorMessage = error?.message || '';
      
      // Detectar erro SSL pela mensagem também (alguns erros não têm código)
      const isSSLError = errorCode === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' || 
                        errorMessage.includes('SSL') || 
                        errorMessage.includes('TLS') ||
                        errorMessage.includes('tlsv1 alert');
      
      // Se for o primeiro erro SSL, aumentar número de tentativas para WiFi
      if (isSSLError && !hasSSLError && attempt === 1) {
        hasSSLError = true;
        actualMaxRetries = Math.max(actualMaxRetries, 5); // Pelo menos 5 tentativas para SSL
      }
      
      // Se não for a última tentativa, aguardar antes de tentar novamente
      if (attempt < actualMaxRetries) {
        const waitTime = isSSLError ? (attempt * 2000) : (attempt * 1000); // 2s, 4s, 6s para SSL ou 1s, 2s, 3s normal
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  console.error('❌ Falha ao conectar ao MongoDB após todas as tentativas');
  throw lastError || new Error('Falha ao conectar ao MongoDB após todas as tentativas');
}




