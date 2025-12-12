# 🧹 Limpeza e Melhorias - Control SI-FMRP

**Data:** $(date)

## 📁 ARQUIVOS PARA REMOVER

### 1. `MORE_BUGS_FIXED.md` ❌
- **Motivo:** Arquivo de documentação temporário sobre bugs já corrigidos
- **Status:** Pode ser removido - informações já estão no histórico do Git
- **Ação:** `rm MORE_BUGS_FIXED.md`

### 2. `lib/fetch-with-auth.ts` ❌
- **Motivo:** Função não utilizada em nenhum lugar do código
- **Status:** Código morto
- **Verificação:** Nenhum import encontrado
- **Ação:** `rm lib/fetch-with-auth.ts`

---

## 🔄 CÓDIGO PARA ATUALIZAR/MELHORAR

### 1. **Limite fixo de 100 movimentos** ⚠️
**Arquivo:** `app/api/estoque/movimentos/route.ts:23`
```typescript
.limit(100)
```
**Problema:** Limite fixo pode não ser suficiente para sistemas grandes
**Melhoria:** 
- Adicionar paginação
- Permitir parâmetro `limit` na query string
- Adicionar parâmetro `page` para navegação

**Sugestão:**
```typescript
const limit = parseInt(searchParams.get('limit') || '100', 10);
const page = parseInt(searchParams.get('page') || '1', 10);
const skip = (page - 1) * limit;

const movimentos = await collection
  .find({})
  .sort({ data: -1 })
  .skip(skip)
  .limit(Math.min(limit, 1000)) // Máximo 1000 por segurança
  .toArray();
```

### 2. **Falta de paginação em listagem de itens** ⚠️
**Arquivo:** `app/api/estoque/route.ts:23`
```typescript
const itens = await collection.find({}).sort({ nome: 1 }).toArray();
```
**Problema:** Carrega todos os itens de uma vez, pode ser lento com muitos itens
**Melhoria:** Adicionar paginação similar aos movimentos

### 3. **Falta de paginação em revisões** ⚠️
**Arquivo:** `app/api/estoque/revisoes/route.ts:257`
```typescript
.find({})
.sort({ ano: -1, mes: -1 })
.toArray();
```
**Problema:** Carrega todas as revisões de uma vez
**Melhoria:** Adicionar paginação

### 4. **Comentários de console.log removidos** 🧹
**Arquivo:** `app/api/estoque/revisoes/route.ts:180, 249`
```typescript
// Removido console.log para produção
// Removidos console.logs para produção
```
**Ação:** Remover comentários desnecessários

### 5. **Proxy não utilizado** ⚠️
**Arquivo:** `proxy.ts`
**Status:** Arquivo existe mas não está sendo usado no Next.js 16
**Verificação:** Next.js 16 usa middleware.ts, não proxy.ts
**Ação:** 
- Verificar se está sendo usado
- Se não, remover ou migrar para `middleware.ts`

---

## 📦 DEPENDÊNCIAS PARA ATUALIZAR

### Verificar atualizações disponíveis:
```bash
npm outdated
```

### Dependências principais:
- `next`: 16.0.7 → Verificar última versão estável
- `react`: 19.2.0 → Verificar compatibilidade
- `react-dom`: 19.2.0 → Verificar compatibilidade
- `mongodb`: 7.0.0 → Verificar última versão
- `jspdf`: 3.0.4 → Verificar atualizações
- `jspdf-autotable`: 5.0.2 → Verificar atualizações

---

## ✨ MELHORIAS SUGERIDAS

### 1. **Índices no MongoDB** 🚀
**Melhoria:** Adicionar índices para melhorar performance
```javascript
// Índices sugeridos:
db.estoque.createIndex({ nome: 1 }); // Para busca por nome
db.movimentacoes.createIndex({ data: -1 }); // Para ordenação por data
db.movimentacoes.createIndex({ itemId: 1 }); // Para busca por item
db.revisoes.createIndex({ ano: -1, mes: -1 }); // Para ordenação
db.usuarios.createIndex({ username: 1 }); // Para busca de usuário
```

### 2. **Cache de consultas frequentes** 🚀
**Melhoria:** Implementar cache para:
- Lista de itens (se não mudar frequentemente)
- Estatísticas do dashboard
- Dados do usuário logado

### 3. **Validação de nomes duplicados case-insensitive** 🔧
**Problema:** Atualmente permite "Item" e "item" como nomes diferentes
**Arquivos:** 
- `app/api/estoque/route.ts:177`
- `app/api/estoque/[id]/route.ts:219`
- `app/api/estoque/entrada-novo-item/route.ts:91`

**Melhoria:**
```typescript
// Normalizar nome para comparação
const nomeNormalizado = nome.trim().toLowerCase();

// Buscar com regex case-insensitive OU normalizar no banco
const itemExistente = await collection.findOne({ 
  nome: { $regex: new RegExp(`^${nomeNormalizado}$`, 'i') }
});
```

### 4. **Transações MongoDB para operações críticas** 🔒
**Arquivos:**
- `app/api/estoque/movimentos/route.ts`
- `app/api/estoque/entrada-novo-item/route.ts`

**Melhoria:** Usar transações para garantir atomicidade:
```typescript
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await estoqueCollection.updateOne(..., { session });
    await movimentacoesCollection.insertOne(..., { session });
  });
} finally {
  await session.endSession();
}
```

### 5. **Validação de quantidade mínima mais inteligente** 🔧
**Problema:** Quantidade mínima pode ser maior que quantidade atual após saída
**Melhoria:** Validar quantidade mínima após calcular nova quantidade:
```typescript
// Em movimentos/route.ts, após calcular novaQuantidade:
if (quantidade_minima && quantidade_minima > novaQuantidade) {
  return NextResponse.json(
    { error: 'Quantidade mínima não pode ser maior que a quantidade após a movimentação' },
    { status: 400 }
  );
}
```

### 6. **Melhor tratamento de erros** 🔧
**Melhoria:** Adicionar códigos de erro específicos:
```typescript
// Em vez de apenas { error: 'Erro interno' }
return NextResponse.json(
  { 
    error: 'Erro ao processar requisição',
    code: 'DATABASE_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  },
  { status: 500 }
);
```

### 7. **Rate limiting** 🛡️
**Melhoria:** Adicionar rate limiting para APIs:
- Prevenir abuso
- Proteger contra ataques DDoS
- Limitar requisições por usuário

### 8. **Logging estruturado** 📝
**Melhoria:** Substituir `console.error` por sistema de logging:
- Usar biblioteca como `winston` ou `pino`
- Logs estruturados (JSON)
- Diferentes níveis (error, warn, info, debug)

### 9. **Validação de tipos mais rigorosa** 🔧
**Melhoria:** Adicionar validação de tipos em runtime:
- Usar biblioteca como `zod` para validação de schemas
- Validar tipos de entrada em todas as APIs

### 10. **Otimização de queries** 🚀
**Melhoria:** 
- Usar projeção para buscar apenas campos necessários
- Evitar buscar todos os campos quando não necessário
```typescript
// Em vez de:
const item = await collection.findOne({ _id: new ObjectId(id) });

// Usar:
const item = await collection.findOne(
  { _id: new ObjectId(id) },
  { projection: { nome: 1, quantidade: 1, quantidade_minima: 1 } }
);
```

---

## 🔍 CÓDIGO DUPLICADO

### 1. **Validação de nome duplicado** 🔄
**Arquivos:**
- `app/api/estoque/route.ts:177`
- `app/api/estoque/[id]/route.ts:219`
- `app/api/estoque/entrada-novo-item/route.ts:91`

**Melhoria:** Criar função helper:
```typescript
// lib/estoque-helpers.ts
export async function verificarNomeDuplicado(
  db: Db,
  nome: string,
  excludeId?: string
): Promise<boolean> {
  const query: any = { nome: nome.trim() };
  if (excludeId) {
    query._id = { $ne: new ObjectId(excludeId) };
  }
  const item = await db.collection('estoque').findOne(query);
  return !!item;
}
```

### 2. **Formatação de resposta de item** 🔄
**Melhoria:** Criar função helper para formatar item:
```typescript
export function formatarItem(item: any) {
  return {
    ...item,
    _id: item._id.toString(),
    criadoEm: item.criadoEm instanceof Date ? item.criadoEm.toISOString() : item.criadoEm,
    atualizadoEm: item.atualizadoEm instanceof Date ? item.atualizadoEm.toISOString() : item.atualizadoEm,
  };
}
```

---

## 📊 RESUMO

### Arquivos para remover: 2
- ✅ `MORE_BUGS_FIXED.md`
- ✅ `lib/fetch-with-auth.ts`

### Melhorias de código: 10
- ⚠️ Paginação em 3 endpoints
- ⚠️ Validação case-insensitive de nomes
- ⚠️ Transações MongoDB
- ⚠️ Índices no banco de dados
- ⚠️ Cache de consultas
- ⚠️ Rate limiting
- ⚠️ Logging estruturado
- ⚠️ Validação com Zod
- ⚠️ Otimização de queries
- ⚠️ Funções helper para código duplicado

### Dependências: Verificar atualizações
- Executar `npm outdated` para verificar

---

## ✅ PRÓXIMOS PASSOS RECOMENDADOS

1. **Imediato:**
   - Remover arquivos não utilizados
   - Remover comentários desnecessários
   - Adicionar paginação nos endpoints principais

2. **Curto prazo:**
   - Implementar índices no MongoDB
   - Adicionar validação case-insensitive
   - Criar funções helper para código duplicado

3. **Médio prazo:**
   - Implementar transações MongoDB
   - Adicionar cache
   - Melhorar tratamento de erros

4. **Longo prazo:**
   - Implementar rate limiting
   - Sistema de logging estruturado
   - Validação com Zod

