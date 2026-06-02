const isCluberlyBrand = process.env.NEXT_PUBLIC_APP_BRAND === 'cluberly'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isCluberlyBrand) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden" style={{ background: '#080C18' }}>

        {/* Animated gradient orbs */}
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: '60vw', height: '60vw', maxWidth: 700, maxHeight: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'orbFloat 12s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-10%',
          width: '55vw', height: '55vw', maxWidth: 650, maxHeight: 650,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
          animation: 'orbFloat 15s ease-in-out infinite reverse',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '50%',
          width: '40vw', height: '40vw', maxWidth: 500, maxHeight: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.10) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'orbFloat 18s ease-in-out infinite 4s',
        }} />

        {/* Subtle dot grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), rgba(168,85,247,0.6), transparent)' }}
        />

        <style>{`
          @keyframes orbFloat {
            0%, 100% { transform: translateY(0px) scale(1); }
            33% { transform: translateY(-30px) scale(1.05); }
            66% { transform: translateY(15px) scale(0.97); }
          }
        `}</style>

        <div className="relative w-full max-w-md px-4 py-10">{children}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1208] to-[#000000]" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#F5C400]/10 blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#F5C400]/5 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(0deg, transparent 24%, #F5C400 25%, #F5C400 26%, transparent 27%, transparent 74%, #F5C400 75%, #F5C400 76%, transparent 77%, transparent),
                            linear-gradient(90deg, transparent 24%, #F5C400 25%, #F5C400 26%, transparent 27%, transparent 74%, #F5C400 75%, #F5C400 76%, transparent 77%, transparent)`,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="relative w-full max-w-md px-4 py-8">{children}</div>
    </div>
  )
}
