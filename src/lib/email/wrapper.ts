// Wrapper visual común a TODOS los emails a familias/jugadores/clubes.
// El cuerpo de la plantilla (editado por el club en /configuracion/plantillas-email)
// es texto limpio con variables — el HTML estético se monta AQUÍ con el branding
// del club. Esto es la clave de que sea fácil para no técnicos: el club edita
// copy puro, no puede romper el diseño.

export interface WrapperContext {
  clubName: string
  clubLogo?: string | null
  primaryColor?: string | null  // clubs.primary_color
  footer?: string | null         // texto del pie (firma + contacto del club)
  contactEmail?: string | null   // mostrado en el footer si existe
}

/** Color por defecto si el club aún no eligió el suyo. */
const DEFAULT_BRAND = '#2563eb'  // azul Cluberly neutro

/**
 * Envuelve el cuerpo del email (HTML del editor del club, sustituido con vars)
 * en una estructura visual común con branding del club. Devuelve HTML completo
 * listo para enviar.
 *
 * Estructura:
 *   ┌──────────────────────────┐
 *   │  [logo del club]         │  ← brand bar (color primary)
 *   ├──────────────────────────┤
 *   │                          │
 *   │  {body del editor}       │  ← cuerpo editado por el club
 *   │                          │
 *   ├──────────────────────────┤
 *   │  Atentamente,            │  ← footer (configurable)
 *   │  {club name}             │
 *   │  contact@club.com        │
 *   └──────────────────────────┘
 */
export function wrapEmailHtml(bodyHtml: string, ctx: WrapperContext): string {
  const brand = ctx.primaryColor || DEFAULT_BRAND
  const clubName = ctx.clubName
  const contactLine = ctx.contactEmail
    ? `<p style="margin:4px 0 0;font-size:13px;color:#94a3b8"><a href="mailto:${escAttr(ctx.contactEmail)}" style="color:#94a3b8;text-decoration:none">${escHtml(ctx.contactEmail)}</a></p>`
    : ''
  // Si el club editó su firma, la respetamos; si no, usamos "Atentamente, <club>".
  const footerHtml = ctx.footer
    ? `<div style="font-size:14px;color:#475569;line-height:1.6">${ctx.footer}</div>`
    : `<p style="margin:0;font-size:14px;color:#475569">Atentamente,</p>
       <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#0F172A">${escHtml(clubName)}</p>
       ${contactLine}`

  const logoBlock = ctx.clubLogo
    ? `<img src="${escAttr(ctx.clubLogo)}" alt="${escAttr(clubName)}" style="height:48px;width:auto;display:block;margin:0 auto;object-fit:contain" />`
    : `<div style="font-size:18px;font-weight:800;color:#fff;text-align:center;letter-spacing:-0.01em">${escHtml(clubName)}</div>`

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(clubName)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
          <!-- Brand bar -->
          <tr>
            <td style="background:${brand};padding:24px">
              ${logoBlock}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;font-size:15px;line-height:1.65;color:#1f2937">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #e2e8f0;background:#fafbfc">
              ${footerHtml}
            </td>
          </tr>
        </table>

        <!-- Sub-footer Cluberly (sutil) -->
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center">
          Email enviado a través de <a href="https://cluberly.club" style="color:#94a3b8;text-decoration:none">Cluberly</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Versión texto plano del email — equivalente al HTML pero plana. Multipart
 * mejora deliverability en Gmail/Outlook (clientes que no renderizan HTML caen
 * a esta versión). Mantenemos el cuerpo + firma; sin estructura visual.
 */
export function wrapEmailText(bodyText: string, ctx: WrapperContext): string {
  const footerLines: string[] = []
  if (ctx.footer) {
    footerLines.push(ctx.footer.replace(/<[^>]+>/g, ''))
  } else {
    footerLines.push('Atentamente,')
    footerLines.push(ctx.clubName)
    if (ctx.contactEmail) footerLines.push(ctx.contactEmail)
  }
  return [
    bodyText.trim(),
    '',
    '---',
    ...footerLines,
    '',
    'Enviado a través de Cluberly · https://cluberly.club',
  ].join('\n')
}

// ── helpers de escape ────────────────────────────────────────────────────────
// Escape HTML en TEXTO de nodo (no atributos). Solo entidades necesarias.
function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
// Escape para atributos HTML (incluye comillas).
function escAttr(s: string): string {
  return escHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
