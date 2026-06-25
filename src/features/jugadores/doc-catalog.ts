// Catálogo de documentos solicitados. base = todos; foreign = extra para NO españoles
// (la RFFM pide NIE/pasaporte/residencia a extranjeros, y a veces varía).
// Módulo plano (NO 'use server') para poder exportar el objeto a cliente y servidor.
// Configurable a futuro por club; de momento un default sensato RFFM.
export const DOC_CATALOG = {
  base: [
    { key: 'photo',      label: 'Foto del jugador (tipo carnet)' },
    { key: 'dni_front',  label: 'DNI/NIE — cara 1' },
    { key: 'dni_back',   label: 'DNI/NIE — cara 2 / Libro de familia' },
    { key: 'birth_cert', label: 'Certificado de nacimiento' },
  ],
  foreign: [
    { key: 'nie',            label: 'NIE del jugador' },
    { key: 'passport',       label: 'Pasaporte' },
    { key: 'residency_cert', label: 'Permiso de residencia / empadronamiento' },
  ],
} as const
