import { useRuntimeConfig } from '#imports'

const FROM_EMAIL = 'ClawLab <noreply@claw-lab.ai>'

function getPostmarkToken(): string {
  const config = useRuntimeConfig()
  const token = config.postmarkApiToken as string
  if (!token) {
    throw new Error('POSTMARK_API_TOKEN is not configured')
  }
  return token
}

async function sendEmail(opts: {
  to: string
  subject: string
  htmlBody: string
  textBody: string
}) {
  const token = getPostmarkToken()

  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: FROM_EMAIL,
      To: opts.to,
      Subject: opts.subject,
      HtmlBody: opts.htmlBody,
      TextBody: opts.textBody,
      MessageStream: 'outbound',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[email] Postmark error:', res.status, err)
    throw new Error(`Failed to send email: ${res.status}`)
  }

  return res.json()
}

/**
 * Generate a 4-character alphanumeric verification code.
 * Excludes ambiguous characters (I, O, 0, 1) for readability.
 */
export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 4; i++) {
    code += chars[bytes[i]! % chars.length]
  }
  return code
}

export async function sendMagicLinkEmail(to: string, magicLink: string, code: string) {
  const subject = `${code} — Sign in to ClawLab`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 0;">
          <div style="width:36px;height:36px;background:#0f172a;border-radius:8px;display:inline-block;vertical-align:middle;">
            <img src="data:image/svg+xml,%3Csvg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27' stroke='white' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27' stroke='white' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" width="36" height="36" alt="ClawLab" style="display:block;"/>
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0f172a;">Sign in to ClawLab</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.5;">
            Enter this verification code on the sign-in page:
          </p>

          <!-- Code -->
          <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:'Courier New',monospace;">${code}</span>
          </div>

          <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.5;">
            Or click the button below to sign in directly:
          </p>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${magicLink}" style="display:inline-block;padding:14px 32px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                Sign in to ClawLab
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 32px 32px;">
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const textBody = `Sign in to ClawLab

Your verification code: ${code}

Or use this link to sign in:
${magicLink}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`

  return sendEmail({ to, subject, htmlBody, textBody })
}

export async function sendInviteEmail(opts: {
  to: string
  inviterName: string
  organizationName: string
  workspaceName: string
  role: string
  inviteLink: string
  code: string
}) {
  const { to, inviterName, organizationName, workspaceName, role, inviteLink, code } = opts
  const subject = `${code} — You've been invited to ${workspaceName}`

  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase()

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 0;">
          <div style="width:36px;height:36px;background:#0f172a;border-radius:8px;display:inline-block;vertical-align:middle;">
            <img src="data:image/svg+xml,%3Csvg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27' stroke='white' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27' stroke='white' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" width="36" height="36" alt="ClawLab" style="display:block;"/>
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0f172a;">You've been invited</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.5;">
            <strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong> at <strong>${organizationName}</strong> as a <strong>${roleLabel}</strong>.
          </p>

          <p style="margin:0 0 12px;font-size:15px;color:#64748b;line-height:1.5;">
            Enter this verification code when accepting the invite:
          </p>

          <!-- Code -->
          <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:'Courier New',monospace;">${code}</span>
          </div>

          <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.5;">
            Click below to get started:
          </p>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                Accept invite
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 32px 32px;">
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
              This invite expires in 14 days. If you didn't expect this, you can safely ignore this email.
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const textBody = `You've been invited to ${workspaceName}

${inviterName} invited you to join ${workspaceName} at ${organizationName} as a ${roleLabel}.

Your verification code: ${code}

Accept the invite here:
${inviteLink}

This invite expires in 14 days. If you didn't expect this, you can safely ignore this email.`

  return sendEmail({ to, subject, htmlBody, textBody })
}
