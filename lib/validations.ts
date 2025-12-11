/**
 * Funções de validação reutilizáveis
 */

/**
 * Valida tamanho de string
 */
export function validateStringLength(
  value: string | undefined | null,
  fieldName: string,
  min: number = 1,
  max: number = 500
): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: `${fieldName} é obrigatório` };
  }

  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: `${fieldName} não pode ser vazio` };
  }

  if (trimmed.length < min) {
    return { valid: false, error: `${fieldName} deve ter no mínimo ${min} caracteres` };
  }

  if (trimmed.length > max) {
    return { valid: false, error: `${fieldName} deve ter no máximo ${max} caracteres` };
  }

  return { valid: true };
}

/**
 * Valida número
 */
export function validateNumber(
  value: any,
  fieldName: string,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER,
  allowZero: boolean = true
): { valid: boolean; error?: string; value?: number } {
  if (value === undefined || value === null) {
    return { valid: false, error: `${fieldName} é obrigatório` };
  }

  const num = Number(value);
  
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} deve ser um número válido` };
  }

  if (!allowZero && num === 0) {
    return { valid: false, error: `${fieldName} deve ser maior que zero` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} deve ser no mínimo ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} deve ser no máximo ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Valida data
 */
export function validateDate(
  value: any,
  fieldName: string
): { valid: boolean; error?: string; value?: Date } {
  if (!value) {
    return { valid: false, error: `${fieldName} é obrigatório` };
  }

  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} deve ser uma data válida` };
  }

  return { valid: true, value: date };
}

/**
 * Valida mês (1-12)
 */
export function validateMonth(month: any): { valid: boolean; error?: string; value?: number } {
  const validation = validateNumber(month, 'Mês', 1, 12);
  if (!validation.valid) {
    return validation;
  }

  const monthNum = Math.floor(validation.value!);
  if (monthNum < 1 || monthNum > 12) {
    return { valid: false, error: 'Mês deve estar entre 1 e 12' };
  }

  return { valid: true, value: monthNum };
}

/**
 * Valida ano (1900-2100)
 */
export function validateYear(year: any): { valid: boolean; error?: string; value?: number } {
  const validation = validateNumber(year, 'Ano', 1900, 2100);
  if (!validation.valid) {
    return validation;
  }

  const yearNum = Math.floor(validation.value!);
  if (yearNum < 1900 || yearNum > 2100) {
    return { valid: false, error: 'Ano deve estar entre 1900 e 2100' };
  }

  return { valid: true, value: yearNum };
}

/**
 * Valida senha
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Senha é obrigatória' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'A senha deve ter no mínimo 6 caracteres' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'A senha deve ter no máximo 128 caracteres' };
  }

  return { valid: true };
}

/**
 * Valida email
 */
export function validateEmailLength(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email é obrigatório' };
  }

  if (email.length > 255) {
    return { valid: false, error: 'Email deve ter no máximo 255 caracteres' };
  }

  return { valid: true };
}

