export type SignatureInput = {
  fullName: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  extra?: string;
  companyLogoUrl: string;
  userLogoUrl?: string;
};

function esc(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildOutlookSignatureHtml(input: SignatureInput) {
  const fullName = esc(input.fullName.trim());
  const title = esc(input.title.trim());
  const phone = esc(input.phone.trim());
  const email = esc(input.email.trim());
  const address = esc(input.address.trim());
  const extra = esc((input.extra ?? "").trim());

  const companyLogoH = 48;
  const userLogoH = 48;

  return `
<!-- START SIGNATURE -->
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;line-height:16px;color:#111;">
  <tr>
    <td valign="middle" style="padding:0 12px 0 0;border-right:1px solid #ddd;">
      <img src="${input.companyLogoUrl}" alt="Company" height="${companyLogoH}" style="display:block;border:0;outline:none;text-decoration:none;height:${companyLogoH}px;" />
    </td>

    <td valign="middle" style="padding:0 0 0 12px;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;line-height:18px;font-weight:700;color:#111;padding:0 0 2px 0;">${fullName}</td>
        </tr>
        <tr>
          <td style="font-size:12px;line-height:16px;color:#444;padding:0 0 8px 0;">${title}</td>
        </tr>

        <tr>
          <td style="padding:0;">
            <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:0 10px 2px 0;">📞</td>
                <td style="padding:0 0 2px 0;">${phone}</td>
              </tr>
              <tr>
                <td style="padding:0 10px 2px 0;">✉️</td>
                <td style="padding:0 0 2px 0;">
                  <a href="mailto:${email}" style="color:#f00;text-decoration:none;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:0 10px 2px 0;">📍</td>
                <td style="padding:0 0 2px 0;">${address}</td>
              </tr>
              ${
                extra
                  ? `<tr>
                       <td style="padding:0 10px 0 0;">ℹ️</td>
                       <td style="padding:0;">${extra}</td>
                     </tr>`
                  : ""
              }
            </table>
          </td>
        </tr>
      </table>
    </td>

    ${
      input.userLogoUrl
        ? `
    <td valign="middle" style="padding:0 0 0 14px;">
      <img src="${input.userLogoUrl}" alt="Logo" height="${userLogoH}" style="display:block;border:0;outline:none;text-decoration:none;height:${userLogoH}px;" />
    </td>`
        : ""
    }
  </tr>
</table>
<!-- END SIGNATURE -->
`.trim();
}