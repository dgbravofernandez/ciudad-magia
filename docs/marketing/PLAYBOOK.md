# Playbook de ventas multicanal — Cluberly

> El cold email **abre la puerta**; el cierre es **humano** (email 1:1, WhatsApp, llamada).
> Vender un SaaS de €19/mes a clubes de voluntarios es de baja conversión por email solo
> (benchmark 0,2-0,5%). El 1% global solo llega combinando canales. Esto es lo que mueve la aguja.

## Metas realistas (no las del brief)
- **Leads:** ~7.500-8.000 emails únicos en 2-3 semanas (scraper 24/7 + enriquecimiento). No 10k en 7 días.
- **Conversión:** medir **demos y respuestas**, no solo clics. Cold-email solo 0,3-0,5%; con este playbook apuntar a ~1% global.

---

## Rutina diaria (15-30 min) — lo que cierra ventas

### 1. Trabaja los leads calientes (PRIORIDAD)
```
cd docs/marketing
python hot_leads.py        # o  python hot_leads.py --csv
```
Lista los clubes que **clicaron** un email (interés real) con su teléfono y email.
**Contacta a cada uno en <24h del clic** — la conversión cae 80% pasadas 24h.

- **Si tiene teléfono →** WhatsApp primero (los secretarios responden WhatsApp, no email).
- **Si NO tiene teléfono →** email **personal 1:1** de Diego (no el automático) + busca su teléfono en su web/Google.

### 2. Responde lo que entre
- Respuestas a emails → contesta en <2h en horario laboral.
- Reservas de demo (`/reservar`) → confirma por WhatsApp además del email.

---

## Guiones

### WhatsApp (lead que clicó, con teléfono)
> Hola, soy Diego de Cluberly 👋 Vi que echaste un ojo a lo que te mandé sobre [CLUB].
> ¿Te viene bien que te lo enseñe en 10 min por videollamada esta semana? Sin compromiso —
> y si eres de Madrid te paso el ranking de goleadores de tu categoría en la RFFM, lo tengo recopilado.

### Email personal 1:1 (lead que clicó, sin teléfono)
> Asunto: el ranking de goleadores de [CLUB]
>
> Hola, soy Diego (Cluberly). Vi que abriste lo que te mandé.
> Te lo hago fácil: dime tu categoría y te paso **hoy** el ranking de máximos goleadores
> de la RFFM de tu equipo — lo tengo scrapeado de toda Madrid. Y si quieres, en la misma
> te enseño en 10 min cómo Cluberly te quita el Excel y los WhatsApp de cobrar cuotas.
> ¿Te llamo o prefieres que te escriba por aquí?

### Llamada (45 seg de apertura)
> Hola [nombre], soy Diego de Cluberly, no te robo más de un minuto. Os escribí porque
> ayudamos a clubes como [CLUB] a llevar cuotas, asistencias e inscripciones sin Excel ni
> grupos de WhatsApp. ¿Quién lleva ahora la parte de secretaría/cobros en el club?

---

## Canales de captación (además del cold email)

### Grupos de Facebook (alto ROI, gratis)
Publica valor, no anuncios. 2-3 posts/semana en grupos de entrenadores/clubes de fútbol base:
- "He recopilado los máximos goleadores de la RFFM por categoría, ¿a alguien le sirve para su club?" → genera DMs.
- Build-in-public: "Estoy montando una herramienta para clubes, esto es lo que llevo".

### Referidos
- Ya existe `cluberly.club/recomendar`. Pídelo SIEMPRE al final de una conversación buena
  ("¿conoces otro club al que le venga bien? te lo agradezco con [X]").
- Va al cierre del email_3 de la secuencia.

### Partnerships con federaciones / coordinadores de zona
- Un coordinador que recomiende = 5-10 clubes de golpe. Identifica 2-3 y ofréceles algo.

---

## Qué NO hacer
- No subir el volumen de cold email de golpe → quema el dominio (respeta el ramp del cap diario).
- No esperar que el email solo convierta. El email es para **conseguir la conversación**.
- No ignorar a los que clican y no reservan: ESOS son los leads más calientes que tienes.

---

## Estado del motor (técnico, ya montado)
- **Scraper 24/7:** `refill_autoloop.py` en bucle continuo (refill→import→enrich). Corre hasta apagar el PC.
- **Leads calientes:** `hot_leads.py`.
- **Followups de clic:** se envían **a mano** desde el panel de campañas (decisión tuya).
- **Gancho RFFM:** variante de email para clubes de Madrid (pendiente de afinar copy/HTML contigo).
