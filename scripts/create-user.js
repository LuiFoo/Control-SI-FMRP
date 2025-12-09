/**
 * Script para criar usuário no MongoDB
 * Execute: node scripts/create-user.js
 * 
 * Certifique-se de que o MongoDB está rodando e configure
 * a variável MONGODB_URI no .env.local
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Carregar .env.local se existir
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createUser() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fmrp';
    
    console.log('🔌 Conectando ao MongoDB...');
    
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Conectado ao MongoDB');

    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    const email = await question('Digite o email (@fmrp.usp.br): ');
    
    // Validar email
    const emailRegex = /^[^\s@]+@fmrp\.usp\.br$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Email deve ser do domínio @fmrp.usp.br');
      await client.close();
      rl.close();
      return;
    }

    const password = await question('Digite a senha: ');

    // Verificar se usuário já existe
    const existingUser = await collection.findOne({ username: email });
    if (existingUser) {
      console.log('⚠️  Usuário já existe! Atualizando senha...');
      
      // Atualizar senha
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      await collection.updateOne(
        { username: email },
        { $set: { passwordHash } }
      );
      
      console.log('✅ Senha atualizada com sucesso!');
      console.log('👤 Email:', email);
    } else {
      // Criptografar senha
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Inserir usuário
      const result = await collection.insertOne({
        username: email,
        passwordHash,
      });

      console.log('✅ Usuário criado com sucesso!');
      console.log('🆔 ID:', result.insertedId);
      console.log('👤 Email:', email);
    }

    await client.close();
    rl.close();
    console.log('✅ Conexão fechada');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Dica: Certifique-se de que o MongoDB está rodando');
      console.error('   Ou configure a MONGODB_URI no arquivo .env.local');
    }
    rl.close();
    process.exit(1);
  }
}

createUser();





