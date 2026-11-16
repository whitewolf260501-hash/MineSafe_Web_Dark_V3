export interface ContactFormPayload {
  name: string;
  organization: string;
  email: string;
  message: string;
  website?: string; // Honeypot field (must remain empty)
}

export interface ContactValidationResult {
  valid: boolean;
  errors: Partial<Record<'name' | 'organization' | 'email' | 'message' | 'form', string>>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContactForm(
  payload: ContactFormPayload,
  lastSentTimestamp?: number,
  nowMs: number = Date.now(),
  cooldownMs: number = 30_000
): ContactValidationResult {
  const errors: ContactValidationResult['errors'] = {};

  if (payload.website && payload.website.trim().length > 0) {
    errors.form = 'Solicitud bloqueada por verificación automática.';
    return { valid: false, errors };
  }

  if (lastSentTimestamp && nowMs - lastSentTimestamp < cooldownMs) {
    const remainingSec = Math.ceil((cooldownMs - (nowMs - lastSentTimestamp)) / 1000);
    errors.form = `Espera ${remainingSec} segundos antes de enviar una nueva consulta.`;
    return { valid: false, errors };
  }

  const name = payload.name.trim();
  const org = payload.organization.trim();
  const email = payload.email.trim();
  const message = payload.message.trim();

  if (name.length < 2 || name.length > 100) {
    errors.name = 'Ingresa un nombre válido (entre 2 y 100 caracteres).';
  }

  if (org.length < 2 || org.length > 120) {
    errors.organization = 'Indica la organización o faena (entre 2 y 120 caracteres).';
  }

  if (!EMAIL_REGEX.test(email) || email.length > 160) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (message.length < 10 || message.length > 1200) {
    errors.message = 'Describe brevemente tu consulta (mínimo 10 caracteres).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildContactMailtoHref(
  officialEmail: string,
  payload?: Partial<ContactFormPayload>
): string {
  const cleanTarget = officialEmail.trim();
  if (!cleanTarget || !EMAIL_REGEX.test(cleanTarget)) return '';

  const subject = payload?.organization?.trim()
    ? `Consulta MineSafe — ${payload.organization.trim()}`
    : 'Consulta sobre prototipo MineSafe';

  const bodyLines = [
    payload?.name?.trim() ? `Nombre: ${payload.name.trim()}` : '',
    payload?.organization?.trim() ? `Organización: ${payload.organization.trim()}` : '',
    payload?.email?.trim() ? `Correo de contacto: ${payload.email.trim()}` : '',
    payload?.message?.trim() ? `\nMensaje:\n${payload.message.trim()}` : '',
  ].filter(Boolean);

  const queryParts = [`subject=${encodeURIComponent(subject)}`];
  if (bodyLines.length > 0) {
    queryParts.push(`body=${encodeURIComponent(bodyLines.join('\n'))}`);
  }

  return `mailto:${cleanTarget}?${queryParts.join('&')}`;
}
