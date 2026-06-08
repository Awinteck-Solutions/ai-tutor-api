import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter =
  env.smtp.host && env.smtp.user && env.smtp.pass
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      })
    : null;

export async function sendMail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!transporter) {
    console.warn(`[Email] SMTP not configured. Would send to ${to}: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    html,
  });
}

export function passwordResetEmail(name: string, resetUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link expires in 1 hour.</p>
    </div>
  `;
}

export function welcomeEmail(name: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to AI Tutor!</h2>
      <p>Hi ${name},</p>
      <p>Your account has been created successfully.</p>
    </div>
  `;
}

export function inviteEmail(orgName: string, inviteUrl: string, role: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You're invited to ${orgName}</h2>
      <p>You have been invited as a <strong>${role}</strong>.</p>
      <p><a href="${inviteUrl}">Accept Invitation</a></p>
    </div>
  `;
}
