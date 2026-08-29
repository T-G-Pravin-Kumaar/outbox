import nodemailer from 'nodemailer';
import { config } from '../config/env';

let cachedTestAccount: nodemailer.TestAccount | null = null;

export async function getEtherealAccount(): Promise<nodemailer.TestAccount> {
  if (cachedTestAccount) {
    return cachedTestAccount;
  }

  if (config.smtp.user && config.smtp.pass) {
    cachedTestAccount = {
      user: config.smtp.user,
      pass: config.smtp.pass,
      smtp: {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: false,
      },
      imap: {
        host: 'imap.ethereal.email',
        port: 993,
        secure: true,
      },
      pop3: {
        host: 'pop3.ethereal.email',
        port: 995,
        secure: true,
      },
      web: 'https://ethereal.email',
    };
    console.log(`[Mailer] Using configured Ethereal SMTP account: ${cachedTestAccount.user}`);
    return cachedTestAccount;
  }

  console.log('[Mailer] No SMTP credentials in environment, generating real Ethereal test account...');
  cachedTestAccount = await nodemailer.createTestAccount();
  console.log(`[Mailer] Ethereal test account created: ${cachedTestAccount.user}`);
  return cachedTestAccount;
}

export async function sendEmailViaEthereal(options: {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  body: string;
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure?: boolean;
  };
}): Promise<{ messageId: string; previewUrl: string | false }> {
  let host = options.smtpConfig?.host;
  let port = options.smtpConfig?.port;
  let user = options.smtpConfig?.user;
  let pass = options.smtpConfig?.pass;
  let secure = options.smtpConfig?.secure ?? false;

  if (!host || !user || !pass) {
    const account = await getEtherealAccount();
    host = account.smtp.host;
    port = account.smtp.port;
    user = account.user;
    pass = account.pass;
    secure = account.smtp.secure;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 20px; line-height: 1.6;">
    <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #312e81;">${options.subject}</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">From: ${options.fromName} &lt;${options.fromEmail}&gt;</p>
    </div>
    <div style="font-size: 15px;">
      ${options.body.replace(/\n/g, '<br/>')}
    </div>
    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 12px; color: #94a3b8;">
      Sent via ReachInbox Outbox Scheduler • Fake SMTP (Ethereal Email)
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${options.fromName}" <${options.fromEmail}>`,
    to: options.toEmail,
    subject: options.subject,
    text: options.body,
    html: formattedHtml,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
