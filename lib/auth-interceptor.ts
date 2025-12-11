// Interceptor para verificar permissão de login em todas as requisições
// Se receber shouldLogout: true, desloga automaticamente

// Usar WeakSet para rastrear requisições já processadas e evitar race conditions
const processedResponses = new WeakSet<Response>();

export function setupAuthInterceptor() {
  if (typeof window === 'undefined') return;

  // Interceptar fetch
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    
    // Evitar processar a mesma resposta múltiplas vezes
    if (processedResponses.has(response)) {
      return response;
    }
    
    // Verificar se a resposta indica que deve deslogar
    // Verificar tanto 403 quanto 401, pois ambos podem indicar falta de permissão
    if (response.status === 403 || response.status === 401) {
      // Verificar se é uma resposta JSON antes de tentar fazer parse
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (isJson) {
        try {
          // Clonar resposta para poder ler o JSON sem consumir o stream
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          
          if (data.shouldLogout && typeof window !== 'undefined') {
            processedResponses.add(response);
            // Remover token
            localStorage.removeItem('token');
            // Redirecionar para login imediatamente
            window.location.href = '/login';
            return response;
          }
        } catch (e) {
          // Se não conseguir fazer parse, ignorar (não é JSON válido)
          // Mas ainda pode ser um erro de autenticação
        }
      }
      
      // Se for erro de autenticação (403 ou 401) e não for JSON ou não tiver shouldLogout,
      // ainda assim pode ser necessário deslogar em alguns casos
      // Mas vamos ser mais conservadores e só deslogar se explicitamente indicado
    }
    
    processedResponses.add(response);
    return response;
  };
}

// Inicializar interceptor quando o módulo for carregado
if (typeof window !== 'undefined') {
  setupAuthInterceptor();
}

