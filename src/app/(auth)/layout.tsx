export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Background: gradient stadium feel */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1208] to-[#000000]" />

      {/* Decorative blurred circles in club colors */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#F5C400]/10 blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#F5C400]/5 blur-3xl" />

      {/* Subtle pitch lines */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(0deg, transparent 24%, #F5C400 25%, #F5C400 26%, transparent 27%, transparent 74%, #F5C400 75%, #F5C400 76%, transparent 77%, transparent),
                            linear-gradient(90deg, transparent 24%, #F5C400 25%, #F5C400 26%, transparent 27%, transparent 74%, #F5C400 75%, #F5C400 76%, transparent 77%, transparent)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Content */}
      <div className="relative w-full max-w-md px-4 py-8">{children}</div>
    </div>
  )
}
