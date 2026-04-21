'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  season: string
  seasons: string[]
}

export function SeasonSelector({ season, seasons }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string) {
    startTransition(() => {
      router.push(`/contabilidad/pagos?season=${encodeURIComponent(next)}`)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium">Temporada</label>
      <select
        value={season}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="input w-auto text-sm bg-white"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  )
}
