import { ObjectId } from 'mongodb';

/**
 * Valida se uma string é um ObjectId válido do MongoDB
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // ObjectId tem exatamente 24 caracteres hexadecimais
  if (id.length !== 24) {
    return false;
  }
  
  // Verificar se todos os caracteres são hexadecimais
  const hexRegex = /^[0-9a-fA-F]{24}$/;
  return hexRegex.test(id);
}

/**
 * Cria um ObjectId de forma segura, validando antes
 */
export function createObjectId(id: string): ObjectId | null {
  if (!isValidObjectId(id)) {
    return null;
  }
  
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

