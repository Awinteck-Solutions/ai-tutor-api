import nodemailer from "nodemailer";
import { env } from "../config/env";

export {
  passwordResetEmail,
  welcomeEmail,
  inviteEmail,
} from "./emailTemplates";

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
