import { MongoClient, type ServerMonitoringMode } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Por favor, adicione a variável MONGODB_URI no arquivo .env.local');
}

const uri = process.env.MONGODB_URI;
const options: {
  maxPoolSize?: number;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  connectTimeoutMS?: number;
  retryWrites?: boolean;
  retryReads?: boolean;
  heartbeatFrequencyMS?: number;
  serverMonitoringMode?: ServerMonitoringMode;
} = {
  maxPoolSize: 10,
  // Aumentar timeouts para WiFi (que pode ter latência maior)
  serverSelectionTimeoutMS: 30000, // 30 segundos (aumentado de 5s)
  socketTimeoutMS: 60000, // 60 segundos (aumentado de 45s)
  connectTimeoutMS: 30000, // 30 segundos (aumentado de 10s)
  // Habilitar retry automático
  retryWrites: true,
  retryReads: true,
  // Configurações de heartbeat para manter conexão ativa
  heartbeatFrequencyMS: 10000, // Verificar conexão a cada 10 segundos
  serverMonitoringMode: 'auto',
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // Em desenvolvimento, use uma variável global para evitar múltiplas conexões
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // Em produção, sempre crie um novo cliente
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

/**
 * Função helper para obter cliente MongoDB com retry automático
 * Útil para conexões WiFi instáveis que podem ter timeouts
 */
export async function getMongoClientWithRetry(maxRetries: number = 3): Promise<MongoClient> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await clientPromise;
      return client;
    } catch (error: any) {
      lastError = error;
      console.error(`Erro ao conectar ao MongoDB (tentativa ${attempt}/${maxRetries}):`, error);
      
      // Se não for a última tentativa, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000; // 1s, 2s, 3s
        console.log(`Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  throw lastError || new Error('Falha ao conectar ao MongoDB após todas as tentativas');
}




