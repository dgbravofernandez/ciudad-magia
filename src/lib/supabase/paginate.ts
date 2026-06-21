/**
 * Trae TODAS las filas de una query Supabase paginando en bloques.
 *
 * PostgREST/Supabase corta cada request a 1000 filas. En datasets grandes
 * (p. ej. quota_payments de una temporada: >2000 filas con varias cuotas por
 * jugador) esto hace que los agregados salgan INCOMPLETOS — totales a la mitad
 * y sumas por jugador parciales. Paginar con .range() trae el conjunto entero.
 *
 * `build` debe devolver una query NUEVA en cada llamada (un builder de
 * supabase-js no se puede reutilizar tras await). Ejemplo:
 *   fetchAllRows(() => sb.from('quota_payments').select('*').eq('club_id', id))
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows(build: () => any, pageSize = 1000, maxRows = Infinity): Promise<any[]> {
  let from = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  for (;;) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize || out.length >= maxRows) break
    from += pageSize
  }
  return maxRows === Infinity ? out : out.slice(0, maxRows)
}
