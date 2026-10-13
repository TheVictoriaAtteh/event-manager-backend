import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailDeliveryError, isRetryableResendError } from './email.errors';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: {
      filename: string;
      content: Buffer;
    }[],
  ) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to,
        subject,
        html,
        attachments,
      });

      if (error) {
        this.logger.error('Email provider rejected a delivery request');
        throw new EmailDeliveryError(
          error.message,
          isRetryableResendError(error),
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof EmailDeliveryError) {
        throw error;
      }

      this.logger.error('Email delivery failed unexpectedly');
      throw new EmailDeliveryError(
        error instanceof Error ? error.message : 'Failed to send email',
        true,
      );
    }
  }
}