import { env } from '../config/env';
import { logger } from '../config/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

/** Development sender: logs that an email would be sent, without the body (it may contain a reset link). */
class ConsoleEmailSender implements EmailSender {
  public outbox: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    this.outbox.push(msg);
    logger.info({ subject: msg.subject }, 'Email queued (console provider — not delivered)');
  }
}

/**
 * SMTP / email-API integration point. Requires a provider account and, for
 * health-related mail, a Business Associate Agreement where HIPAA applies.
 * Implement with nodemailer or the provider SDK once credentials exist.
 */
class SmtpEmailSender implements EmailSender {
  async send(_msg: EmailMessage): Promise<void> {
    throw new Error('SMTP email provider is not configured. See docs/EXTERNAL_SERVICES.md.');
  }
}

export const emailSender: EmailSender = env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailSender() : new ConsoleEmailSender();
export const consoleOutbox = () => (emailSender instanceof ConsoleEmailSender ? emailSender.outbox : []);
