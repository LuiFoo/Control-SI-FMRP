// Funções auxiliares para o cliente (front-end)

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('token', token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem('token');
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export async function verifyToken(): Promise<boolean> {
  const token = getToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/verify', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function verifyAdminPermission(): Promise<boolean> {
  const token = getToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/verify-permission', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.isAdmin === true;
  } catch (error) {
    return false;
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@fmrp\.usp\.br$/;
  return emailRegex.test(email);
}

