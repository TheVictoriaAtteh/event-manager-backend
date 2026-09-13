import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
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
        from: 'onboarding@resend.dev',
        to,
        subject,
        html,
        attachments,
      });

      if (error) {
        console.error('Resend error:', error);
        throw new InternalServerErrorException('Failed to send email');
      }

      return data;
    } catch (error) {
      console.error('Email error:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}