export const ROLES = [
  'admin',
  'direccion',
  'director_deportivo',
  'coordinador',
  'entrenador',
  'fisio',
  'infancia',
  'redes',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  direccion: 'Dirección',
  director_deportivo: 'Director Deportivo',
  coordinador: 'Coordinador',
  entrenador: 'Entrenador',
  fisio: 'Fisioterapeuta',
  infancia: 'Dpto. Infancia',
  redes: 'Redes Sociales',
}

export type Permission =
  | 'players:read_all'
  | 'players:read_team'
  | 'players:read_injured'
  | 'players:write'
  | 'players:write_coord'
  | 'sessions:write'
  | 'sessions:write_own'
  | 'accounting:read'
  | 'accounting:write'
  | 'emails:send'
  | 'club:configure'
  | 'incidents:read_all'
  | 'incidents:read_own'
  | 'meetings:propose'
  | 'photos:approve'
  | 'photos:upload'
  | 'coach_evaluations:read'
  | 'exercise_categories:manage'
  | 'scouting:read'
  | 'calendar:manage'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'players:read_all', 'players:write',
    'sessions:write', 'sessions:write_own',
    'accounting:read', 'accounting:write',
    'emails:send', 'club:configure',
    'incidents:read_all', 'meetings:propose',
    'photos:approve', 'photos:upload',
    'coach_evaluations:read', 'exercise_categories:manage',
    'scouting:read', 'calendar:manage',
  ],
  direccion: [
    'players:read_all', 'players:write',
    'sessions:write',
    'accounting:read', 'accounting:write',
    'emails:send', 'club:configure',
    'incidents:read_all', 'meetings:propose',
    'photos:approve', 'photos:upload',
    'coach_evaluations:read', 'exercise_categories:manage',
    'scouting:read', 'calendar:manage',
  ],
  director_deportivo: [
    'players:read_all', 'players:write_coord',
    'sessions:write',
    'emails:send',
    'incidents:read_all', 'meetings:propose',
    'photos:upload',
    'coach_evaluations:read', 'exercise_categories:manage',
    'scouting:read',
  ],
  coordinador: [
    'players:read_all',
    'players:write_coord',
    'sessions:write',
    'emails:send',
    'incidents:read_all', 'meetings:propose',
    'photos:upload',
    'scouting:read',
  ],
  entrenador: [
    'players:read_team',
    'sessions:write_own',
    'incidents:read_own',
    'photos:upload',
  ],
  fisio: [
    'players:read_injured',
  ],
  infancia: [
    'players:read_all',
    'incidents:read_all', 'meetings:propose',
  ],
  redes: [
    'photos:approve', 'photos:upload',
  ],
}

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission))
}

export function hasAnyRole(userRoles: Role[], requiredRoles: Role[]): boolean {
  return userRoles.some((r) => requiredRoles.includes(r))
}

export function isStaffRole(role: Role): boolean {
  return ['fisio', 'infancia', 'redes', 'direccion'].includes(role)
}

export function isSportsRole(role: Role): boolean {
  return ['entrenador', 'coordinador', 'director_deportivo'].includes(role)
}
