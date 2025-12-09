# Sistema de Autenticação

Este projeto implementa um sistema completo de autenticação usando MongoDB, bcrypt e JWT.

## Características

- ✅ Login com email @fmrp.usp.br
- ✅ Senhas criptografadas com bcrypt
- ✅ Tokens JWT para autenticação
- ✅ Proteção de rotas no servidor e cliente
- ✅ Validação de domínio de email

## Estrutura do Banco de Dados

**Banco:** `fmrp`  
**Coleção:** `usuarios`

```javascript
{
  "_id": ObjectId("..."),
  "username": "usuario@fmrp.usp.br",
  "passwordHash": "$2b$10$..." // Hash bcrypt
}
```

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
MONGODB_URI=mongodb://localhost:27017/fmrp
# ou para MongoDB Atlas:
# MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/fmrp

JWT_SECRET=seu-secret-key-super-seguro-aqui-mude-em-producao
```

### 2. Criar Usuário

Execute o script para criar um usuário:

```bash
node scripts/create-user.js
```

Ou manualmente no MongoDB:

```javascript
use fmrp

// Gerar hash da senha primeiro (use bcrypt)
db.usuarios.insertOne({
  username: "usuario@fmrp.usp.br",
  passwordHash: "$2b$10$..." // Hash bcrypt da senha
})
```

## Como Usar

### Proteger uma Página

Envolva o conteúdo da página com o componente `ProtectedRoute`:

```tsx
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MinhaPage() {
  return (
    <ProtectedRoute>
      <div>Conteúdo protegido</div>
    </ProtectedRoute>
  );
}
```

### Fazer Requisições Autenticadas

Use o helper `fetchWithAuth` para incluir automaticamente o token:

```tsx
import { fetchWithAuth } from '@/lib/fetch-with-auth';

const response = await fetchWithAuth('/api/minha-rota', {
  method: 'POST',
  body: JSON.stringify({ dados: 'exemplo' }),
});
```

### Verificar Autenticação no Cliente

```tsx
import { isAuthenticated, getToken } from '@/lib/auth-client';

if (isAuthenticated()) {
  const token = getToken();
  // Usar token...
}
```

### Logout

```tsx
import { removeToken } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

function handleLogout() {
  removeToken();
  router.push('/login');
}
```

## Fluxo de Autenticação

1. Usuário preenche email @fmrp.usp.br e senha na página de login
2. Frontend valida que o email é @fmrp.usp.br
3. Frontend envia credenciais para `/api/auth/login`
4. Backend valida novamente o domínio do email
5. Backend verifica credenciais no MongoDB usando bcrypt.compare
6. Se válido, retorna um token JWT
7. Frontend salva o token no localStorage
8. Todas as requisições subsequentes incluem o token no header Authorization
9. Middleware do Next.js verifica o token em todas as rotas protegidas
10. Componente ProtectedRoute verifica o token no cliente

## Segurança

- ✅ Validação de email @fmrp.usp.br no frontend e backend
- ✅ Senhas criptografadas com bcrypt (10 rounds)
- ✅ Tokens JWT com expiração (7 dias)
- ✅ Verificação de token em todas as rotas protegidas
- ✅ Middleware do Next.js para proteção no servidor
- ✅ Componente ProtectedRoute para proteção no cliente

## Notas Importantes

- Apenas emails do domínio @fmrp.usp.br são aceitos
- O token é salvo no `localStorage` do navegador
- O middleware do Next.js verifica cookies e headers Authorization
- Para produção, use uma `JWT_SECRET` forte e única
- Configure adequadamente o `MONGODB_URI` para seu ambiente





