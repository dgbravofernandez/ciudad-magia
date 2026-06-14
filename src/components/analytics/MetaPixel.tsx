'use client'

import Script from 'next/script'

/**
 * Meta Pixel (Facebook/Instagram) — habilita retargeting de visitantes de la landing.
 * Solo se carga si NEXT_PUBLIC_META_PIXEL_ID está configurado en env.
 * Si no está, no renderiza nada (no rompe nada).
 *
 * Para activarlo:
 * 1. Crear pixel en https://business.facebook.com -> Events Manager -> Pixels
 * 2. Copiar el ID
 * 3. Añadir NEXT_PUBLIC_META_PIXEL_ID=123456789 en Vercel envs
 * 4. Redeploy
 *
 * Permite crear anuncios en Facebook/Instagram que solo se muestran a quienes
 * visitaron Cluberly pero no convirtieron. CTR típico 8-12% vs 1-2% cold.
 */
export function MetaPixel() {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID
  if (!id) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${id}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img height="1" width="1" style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
          alt="" />
      </noscript>
    </>
  )
}
