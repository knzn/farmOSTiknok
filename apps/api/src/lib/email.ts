import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'TIKNOK <noreply@tiknok.com>'
const APP_NAME = 'TIKNOK'

// ─── send helper ─────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log to console instead of sending
    console.log(`[email] TO: ${to} | SUBJECT: ${subject}`)
    return
  }

  await resend.emails.send({ from: FROM, to, subject, html })
}

// ─── templates ───────────────────────────────────────────────────────────────

export function passwordResetTemplate(resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0A0A0A;color:#FFFFFF;border-radius:12px;">
      <h2 style="color:#C8A84B;margin-bottom:8px;">${APP_NAME}</h2>
      <h3 style="margin-bottom:24px;font-size:18px;">Reset Your Password</h3>

      <p style="color:#A0A0A0;line-height:1.6;margin-bottom:24px;">
        We received a request to reset your password. Click the button below to set a new one.
        This link expires in <strong style="color:#FFFFFF;">1 hour</strong>.
      </p>

      <a href="${resetUrl}"
         style="display:inline-block;background:#C8A84B;color:#0A0A0A;text-decoration:none;
                font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;margin-bottom:24px;">
        Reset Password
      </a>

      <p style="color:#606060;font-size:12px;line-height:1.6;margin-bottom:8px;">
        If you didn't request this, ignore this email — your password won't change.
      </p>

      <p style="color:#606060;font-size:12px;">
        Or copy this link:<br/>
        <span style="color:#A0A0A0;word-break:break-all;">${resetUrl}</span>
      </p>
    </div>
  `
}
