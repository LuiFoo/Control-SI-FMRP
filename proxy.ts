import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Não aplicar proxy em rotas da API
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Permitir acesso a arquivos estáticos (imagens, favicon, etc)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Tentar obter token do header Authorization ou cookie
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7)
    : request.cookies.get('token')?.value;

  // Permitir acesso à página de login e cadastro sem token
  if (pathname === '/login' || pathname === '/cadastro') {
    // Se já tem token, permitir acesso (a validação será feita no cliente)
    return NextResponse.next();
  }

  // Proteger todas as outras rotas
  // A validação completa do token será feita no componente ProtectedRoute
  // O proxy apenas verifica se existe um token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next (Next.js internal files)
     * - Static files (images, fonts, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};


