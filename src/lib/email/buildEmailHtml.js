// src/lib/email/buildEmailHtml.js
// Shared HTML email template for Stock Buddy transactional emails.
// Used by approve-tester and reject-tester API routes.

/**
 * @param {object} opts
 * @param {string} opts.bodyHtml   - The inner HTML content (paragraphs, button, etc.)
 * @returns {string} Full HTML email string
 */
export function buildEmailHtml({ bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stock Buddy</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:#1f2937;padding:18px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Logo -->
                  <td style="vertical-align:middle;width:56px;">
                    <img
                      src="https://stock-buddy.brandongillon.com/SB_Email_Logo.png"
                      alt="SB"
                      width="48"
                      height="48"
                      style="display:block;width:48px;height:48px;border:0;border-radius:6px;object-fit:contain;"
                    />
                  </td>
                  <!-- Brand name -->
                  <td style="vertical-align:middle;padding-left:12px;">
                    <div style="font-size:20px;font-weight:700;color:#0099FF;line-height:1.2;letter-spacing:-0.3px;">
                      Stock Buddy
                    </div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:3px;">
                      Inventory Management for the Modern Age
                    </div>
                  </td>
                  <!-- Right: A Buddy System app — bottom aligned -->
                  <td style="vertical-align:bottom;text-align:right;padding-bottom:2px;">
                    <div style="font-size:10px;color:#6b7280;">
                      A Buddy System app
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 36px 28px 36px;font-size:14px;line-height:1.7;color:#374151;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background-color:#f3f4f6;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">Buddy System Apps</p>
              <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">
                <a href="mailto:support@brandongillon.com" style="color:#6b7280;text-decoration:none;">support@brandongillon.com</a>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">&copy; 2026 Buddy System Apps</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
