/**
 * Script para verificar usuário no MongoDB
 * Execute: node scripts/check-user.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

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

async function checkUser() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fmrp';
    
    console.log('🔌 Conectando ao MongoDB...');
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Conectado ao MongoDB');

    const db = client.db('fmrp');
    const collection = db.collection('usuarios');

    // Listar todos os usuários
    const users = await collection.find({}).toArray();
    
    console.log('\n📋 Usuários encontrados:');
    console.log('='.repeat(60));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. Usuário:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Permissão: ${user.permissao || 'NÃO DEFINIDA'}`);
      console.log(`   Tem passwordHash: ${!!user.passwordHash}`);
      if (user.passwordHash) {
        console.log(`   PasswordHash: ${user.passwordHash.substring(0, 20)}...`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`\nTotal de usuários: ${users.length}`);
    
    // Verificar usuários admin
    const admins = users.filter(u => u.permissao === 'admin');
    console.log(`Usuários admin: ${admins.length}`);
    
    if (admins.length === 0) {
      console.log('\n⚠️  ATENÇÃO: Nenhum usuário com permissão "admin" encontrado!');
      console.log('   Para permitir login, atualize a permissão no MongoDB:');
      console.log('   db.usuarios.updateOne({ username: "seu@email.fmrp.usp.br" }, { $set: { permissao: "admin" } })');
    }

    await client.close();
    console.log('\n✅ Conexão fechada');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkUser();





