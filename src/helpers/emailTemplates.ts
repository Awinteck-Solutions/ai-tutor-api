import { env } from "../config/env";

/** Brand colors aligned with the Adesia web theme */
const BRAND = {
  gold: "#E8B923",
  goldDark: "#B8860B",
  goldLight: "#F5D547",
  ink: "#0F0F0F",
  text: "#1A1A1A",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  background: "#F4F4F5",
  header: "#111111",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailLayoutOptions = {
  preheader?: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
};

export function buildEmailLayout({
  preheader,
  title,
  bodyHtml,
  cta,
  footerNote,
}: EmailLayoutOptions): string {
  const appUrl = env.frontendBaseUrl.replace(/\/$/, "");
  const logoUrl = `${appUrl}/adesia-icon.svg`;
  const appLabel = appUrl.replace(/^https?:\/\//, "");
  const safeTitle = escapeHtml(title);
  const safePreheader = preheader ? escapeHtml(preheader) : safeTitle;
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : "";

  const ctaBlock = cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
        <tr>
          <td align="center" style="border-radius:12px;background:${BRAND.gold};">
            <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.ink};text-decoration:none;border-radius:12px;">
              ${escapeHtml(cta.label)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};word-break:break-all;">
        Or copy this link: <a href="${cta.url}" style="color:${BRAND.goldDark};">${escapeHtml(cta.url)}</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.background};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safePreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${BRAND.surface};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 24px;background:${BRAND.header};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" valign="middle" style="padding-right:14px;">
                    <img src="${logoUrl}" width="48" height="48" alt="Adesia" style="display:block;border:0;border-radius:12px;"/>
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">
                      Adesia
                    </p>
                    <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#A3A3A3;">
                      AI tutor from your materials
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Gold accent -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,${BRAND.goldLight},${BRAND.gold},${BRAND.goldDark});font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 20px;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};letter-spacing:-0.02em;">
                ${safeTitle}
              </h1>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.text};">
                ${bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#FAFAFA;border-top:1px solid ${BRAND.border};">
              ${safeFooterNote ? `<p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${BRAND.muted};">${safeFooterNote}</p>` : ""}
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                <a href="${appUrl}" style="color:${BRAND.goldDark};text-decoration:none;font-weight:600;">${escapeHtml(appLabel)}</a>
                &nbsp;·&nbsp; AI-powered lessons, flashcards &amp; quizzes
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} Adesia. You received this email because of activity on your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

function infoBox(content: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px 18px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:${BRAND.text};">
          ${content}
        </td>
      </tr>
    </table>`;
}

export function passwordResetEmail(name: string, resetUrl: string): string {
  const safeName = escapeHtml(name);
  return buildEmailLayout({
    preheader: "Reset your Adesia password — link expires in 1 hour.",
    title: "Reset your password",
    bodyHtml: `
      ${paragraph(`Hi ${safeName},`)}
      ${paragraph("We received a request to reset the password for your Adesia account. Click the button below to choose a new password.")}
      ${infoBox("<strong>Security note:</strong> This link expires in <strong>1 hour</strong>. If you didn't request a reset, you can safely ignore this email — your password won't change.")}
    `,
    cta: { label: "Reset password", url: resetUrl },
    footerNote: "For your security, never share this link with anyone.",
  });
}

export function welcomeEmail(name: string): string {
  const safeName = escapeHtml(name);
  const appUrl = env.frontendBaseUrl.replace(/\/$/, "");
  return buildEmailLayout({
    preheader: "Your Adesia account is ready — start learning with AI-powered lessons.",
    title: "Welcome to Adesia",
    bodyHtml: `
      ${paragraph(`Hi ${safeName},`)}
      ${paragraph("Your account is ready. Adesia turns your PDFs, notes, and topics into structured lessons, flashcards, and quizzes — with an AI tutor grounded in your own materials.")}
      ${infoBox("Upload a file or describe what you want to learn, then practice with quizzes and flashcards tailored to your content.")}
    `,
    cta: { label: "Go to your dashboard", url: `${appUrl}/student/dashboard` },
  });
}

export function inviteEmail(orgName: string, inviteUrl: string, role: string): string {
  const safeOrg = escapeHtml(orgName);
  const safeRole = escapeHtml(role.toLowerCase());
  return buildEmailLayout({
    preheader: `You've been invited to join ${orgName} on Adesia.`,
    title: `Join ${safeOrg}`,
    bodyHtml: `
      ${paragraph(`You've been invited to collaborate on <strong>${safeOrg}</strong> as a <strong>${safeRole}</strong>.`)}
      ${paragraph("Adesia helps teachers and students turn course materials into interactive lessons, practice sets, and AI-assisted study — all in one workspace.")}
      ${infoBox(`Your role: <strong style="text-transform:capitalize;">${safeRole}</strong><br/>This invitation expires in <strong>7 days</strong>.`)}
    `,
    cta: { label: "Accept invitation", url: inviteUrl },
    footerNote: "If you weren't expecting this invitation, you can ignore this email.",
  });
}
