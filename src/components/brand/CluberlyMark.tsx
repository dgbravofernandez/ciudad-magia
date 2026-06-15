/**
 * Logo oficial Cluberly — cuadrado redondeado gradiente rosa→morado
 * con el "campo de fútbol" (círculo + arco + línea + punto) dentro.
 * Mismo que el del login. Usar SIEMPRE este componente para identidad visual.
 */
export function CluberlyMark({ size = 36 }: { size?: number }) {
  const inner = Math.round(size * 0.62)
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      background: 'linear-gradient(135deg,#EC4899 0%,#8B5CF6 50%,#EC4899 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: `0 ${Math.round(size * 0.12)}px ${Math.round(size * 0.4)}px rgba(139,92,246,0.35)`,
    }}>
      <svg width={inner} height={inner} viewBox="0 0 46 46" fill="none">
        <circle cx="23" cy="23" r="18" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" fill="none"/>
        <path d="M23 5 C12.5 5 5 13 5 23 C5 33 12.5 41 23 41" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <line x1="5" y1="23" x2="41" y2="23" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
        <circle cx="23" cy="23" r="4" fill="white" opacity="0.9"/>
      </svg>
    </div>
  )
}
