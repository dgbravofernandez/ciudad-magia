/**
 * Tests para la función applyTokens — extraída de communications.actions.ts
 * (no está exportada, la duplicamos aquí para testearla directamente)
 */
import { describe, it, expect } from 'vitest'

interface RecipientRow {
  id: string
  first_name: string
  last_name: string
  tutor_name: string | null
  tutor_email: string | null
}

const CLUB_NAME = 'Escuela de Fútbol Ciudad de Getafe'

function applyTokens(text: string, row: RecipientRow, extras: Record<string, string> = {}): string {
  const playerName = `${row.first_name} ${row.last_name}`.trim()
  const tutorName = row.tutor_name || playerName
  const tokens: Record<string, string> = {
    '{jugador_nombre}': playerName,
    '{tutor_nombre}': tutorName,
    '{club_nombre}': CLUB_NAME,
    ...extras,
  }
  let out = text
  for (const [k, v] of Object.entries(tokens)) out = out.replaceAll(k, v)
  return out
}

const baseRow: RecipientRow = {
  id: '1',
  first_name: 'Pedro',
  last_name: 'García',
  tutor_name: 'Juan García',
  tutor_email: 'juan@example.com',
}

describe('applyTokens', () => {
  it('reemplaza {jugador_nombre}', () => {
    const result = applyTokens('Hola {jugador_nombre}', baseRow)
    expect(result).toBe('Hola Pedro García')
  })

  it('reemplaza {tutor_nombre}', () => {
    const result = applyTokens('Estimado {tutor_nombre}', baseRow)
    expect(result).toBe('Estimado Juan García')
  })

  it('usa nombre del jugador si tutor_name es null', () => {
    const row = { ...baseRow, tutor_name: null }
    const result = applyTokens('{tutor_nombre}', row)
    expect(result).toBe('Pedro García')
  })

  it('reemplaza {club_nombre}', () => {
    const result = applyTokens('{club_nombre}', baseRow)
    expect(result).toBe(CLUB_NAME)
  })

  it('reemplaza múltiples tokens en el mismo texto', () => {
    const template = 'Hola {tutor_nombre}, tu hijo {jugador_nombre} juega en {club_nombre}.'
    const result = applyTokens(template, baseRow)
    expect(result).toBe(
      'Hola Juan García, tu hijo Pedro García juega en Escuela de Fútbol Ciudad de Getafe.'
    )
  })

  it('reemplaza todas las ocurrencias del mismo token', () => {
    const result = applyTokens('{jugador_nombre} y {jugador_nombre}', baseRow)
    expect(result).toBe('Pedro García y Pedro García')
  })

  it('admite tokens extra', () => {
    const result = applyTokens('{equipo} es el equipo de {jugador_nombre}', baseRow, {
      '{equipo}': 'Benjamín A',
    })
    expect(result).toBe('Benjamín A es el equipo de Pedro García')
  })

  it('token extra sobreescribe token base si coincide la clave', () => {
    const result = applyTokens('{club_nombre}', baseRow, {
      '{club_nombre}': 'Club Overridden',
    })
    expect(result).toBe('Club Overridden')
  })

  it('texto sin tokens queda intacto', () => {
    const result = applyTokens('Sin tokens aquí.', baseRow)
    expect(result).toBe('Sin tokens aquí.')
  })

  it('token desconocido no genera error y queda en el texto', () => {
    const result = applyTokens('{token_inexistente}', baseRow)
    expect(result).toBe('{token_inexistente}')
  })

  it('string vacío devuelve string vacío', () => {
    const result = applyTokens('', baseRow)
    expect(result).toBe('')
  })

  it('nombre del jugador compuesto correctamente', () => {
    const row = { ...baseRow, first_name: 'María José', last_name: 'Martínez López' }
    const result = applyTokens('{jugador_nombre}', row)
    expect(result).toBe('María José Martínez López')
  })
})
