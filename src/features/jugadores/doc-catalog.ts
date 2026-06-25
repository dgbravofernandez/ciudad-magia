// Catálogo de documentos solicitados.
// base   = documentos por defecto para jugadores españoles.
// foreign = documentos para extranjeros. La RFFM puede pedir más a posteriori
//          (residencia, etc.); pedimos lo MÍNIMO viable y se lo decimos al tutor
//          en un aviso para no abrumar (el resto se pide desde la ficha si hace
//          falta — ver request-docs configurable).
// Módulo plano (NO 'use server') para poder exportar el objeto a cliente y servidor.
export const DOC_CATALOG = {
  base: [
    { key: 'photo',      label: 'Foto del jugador (tipo carnet)' },
    { key: 'dni_front',  label: 'DNI/NIE — cara 1' },
    { key: 'dni_back',   label: 'DNI/NIE — cara 2 / Libro de familia' },
    { key: 'birth_cert', label: 'Certificado de nacimiento' },
  ],
  foreign: [
    { key: 'nie',   label: 'NIE del jugador' },
    { key: 'photo', label: 'Foto del jugador (tipo carnet)' },
  ],
  foreignNotice:
    'Si la federación nos pide algún documento adicional (pasaporte, ' +
    'permiso de residencia, etc.), te lo pediremos más adelante por correo.',
} as const
