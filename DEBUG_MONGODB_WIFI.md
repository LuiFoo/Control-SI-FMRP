# Debug: Problema de Conexão MongoDB no WiFi

## O que está acontecendo (baseado nos logs)

### Fluxo Normal:
1. ✅ Servidor inicia
2. ✅ URI MongoDB é modificada com parâmetros TLS
3. ✅ Requisição de login chega ao backend
4. ✅ Validações passam
5. ❌ **TRAVA AQUI**: Conexão MongoDB fica travada no handshake SSL/TLS

### Análise dos Logs:

```
Linha 15-18: URI modificada corretamente
  - tlsAllowInvalidCertificates=true ✅
  - tls=true ✅
  - retryWrites=true ✅

Linha 22-28: Opções aplicadas corretamente
  - tlsAllowInvalidCertificates: true ✅
  - serverSelectionTimeoutMS: 45000 ✅
  - connectTimeoutMS: 45000 ✅

Linha 64: TRAVA AQUI
  - ⏱️ Aguardando conexão com timeout de 15000ms...
  - A promise do client.connect() nunca resolve
  - O handshake SSL/TLS fica travado
```

## O Problema Real

A conexão está **travando no handshake SSL/TLS** entre:
- **Cliente**: Node.js (usando OpenSSL do Windows)
- **Servidor**: MongoDB Atlas (mongodb+srv://)

### Por que funciona no cabo mas não no WiFi?

1. **Latência maior no WiFi**: O handshake SSL requer múltiplas idas e vindas
2. **Interferência de rede**: WiFi pode ter mais perda de pacotes
3. **Firewall/Antivírus**: Pode estar inspecionando conexões SSL
4. **OpenSSL no Windows**: Pode ter problemas com certificados em conexões instáveis

## Soluções Tentadas

1. ✅ Adicionar `tlsAllowInvalidCertificates=true` na URI
2. ✅ Adicionar `tlsAllowInvalidCertificates: true` nas opções
3. ✅ Aumentar timeouts (45s, 90s)
4. ✅ Criar nova conexão a cada tentativa
5. ✅ Adicionar timeout na promise
6. ❌ **Ainda não funciona** - O handshake SSL trava antes de aplicar as opções

## Próximas Tentativas

### Opção 1: Verificar IP no MongoDB Atlas
- MongoDB Atlas pode estar bloqueando seu IP WiFi
- Adicione `0.0.0.0/0` temporariamente na Network Access do Atlas

### Opção 2: Usar conexão direta (não SRV)
- Converter `mongodb+srv://` para `mongodb://` com IPs diretos
- Pode evitar problemas de DNS no WiFi

### Opção 3: Atualizar Node.js/OpenSSL
- Versões mais novas podem ter melhor suporte SSL

### Opção 4: Desabilitar temporariamente antivírus/firewall
- Para testar se está bloqueando a conexão

## Logs Importantes

Quando testar, observe:
- Quanto tempo demora até dar timeout (deve ser 15s na primeira tentativa)
- Se aparece algum erro SSL específico
- Se a conexão consegue ser estabelecida após múltiplas tentativas

