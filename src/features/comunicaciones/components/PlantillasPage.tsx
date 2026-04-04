'use client'
import { FileText, Plus, Edit2, Trash2, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const PLANTILLAS_DEFECTO = [
  { id: '1', nombre: 'Bienvenida al club', asunto: 'Bienvenido/a a {club_nombre}', cuerpo: 'Estimado/a {tutor_nombre},\n\nNos complace comunicarte que {jugador_nombre} ha sido inscrito/a satisfactoriamente en {club_nombre} para la temporada {temporada}.\n\nQuedamos a tu disposición.\n\nUn saludo,\nEl equipo de {club_nombre}' },
  { id: '2', nombre: 'Recordatorio cuota', asunto: 'Recordatorio: cuota mensual pendiente', cuerpo: 'Estimado/a {tutor_nombre},\n\nTe recordamos que la cuota mensual de {jugador_nombre} correspondiente a {mes} está pendiente de pago.\n\nImporte: {importe} €\n\nPuedes realizar el pago mediante transferencia bancaria o en efectivo.\n\nGracias por tu colaboración.\n\nUn saludo,\n{club_nombre}' },
  { id: '3', nombre: 'Carta de prueba', asunto: 'Autorización para prueba en {club_nombre}', cuerpo: 'Estimado/a {tutor_nombre},\n\nPor medio de la presente, comunicamos que {jugador_nombre}, con fecha de nacimiento {fecha_nacimiento}, queda autorizado/a para realizar una prueba de evaluación en {club_nombre}.\n\nLa prueba tendrá lugar el día {fecha_prueba} en nuestras instalaciones.\n\nAtentamente,\n{director_nombre}\nDirector Deportivo\n{club_nombre}' },
  { id: '4', nombre: 'Convocatoria partido', asunto: 'Convocatoria: {equipo} - {fecha_partido}', cuerpo: 'Estimado/a {tutor_nombre},\n\n{jugador_nombre} está convocado/a para el partido del {fecha_partido} a las {hora} en {lugar}.\n\nPor favor, confirma asistencia respondiendo a este correo.\n\nUn saludo,\n{entrenador_nombre}' },
]

export function PlantillasPage() {
  const [plantillas, setPlantillas] = useState(PLANTILLAS_DEFECTO)
  const [editing, setEditing] = useState<typeof PLANTILLAS_DEFECTO[0] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ nombre: '', asunto: '', cuerpo: '' })

  function copyTemplate(p: typeof PLANTILLAS_DEFECTO[0]) {
    navigator.clipboard.writeText(`Asunto: ${p.asunto}\n\n${p.cuerpo}`)
    toast.success('Plantilla copiada al portapapeles')
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de correo</h1>
          <p className="text-sm text-gray-500">{plantillas.length} plantillas disponibles</p>
        </div>
        <button onClick={() => { setForm({ nombre: '', asunto: '', cuerpo: '' }); setShowNew(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      <div className="grid gap-4">
        {plantillas.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-2">Asunto: <em>{p.asunto}</em></p>
                <p className="text-xs text-gray-400 line-clamp-2 whitespace-pre-wrap">{p.cuerpo}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.cuerpo.match(/\{[^}]+\}/g)?.map(v => (
                    <span key={v} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => copyTemplate(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Copiar"><Copy className="w-4 h-4" /></button>
                <button onClick={() => { setEditing(p); setForm({ nombre: p.nombre, asunto: p.asunto, cuerpo: p.cuerpo }) }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => setPlantillas(pl => pl.filter(x => x.id !== p.id))} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showNew || editing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowNew(false); setEditing(null) }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Bienvenida al club" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                <input value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Usa {variable} para campos dinámicos" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo</label>
                <textarea value={form.cuerpo} onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))} rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setShowNew(false); setEditing(null) }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={() => {
                if (editing) {
                  setPlantillas(pl => pl.map(p => p.id === editing.id ? { ...p, ...form } : p))
                } else {
                  setPlantillas(pl => [...pl, { id: Date.now().toString(), ...form }])
                }
                setShowNew(false); setEditing(null)
                toast.success(editing ? 'Plantilla actualizada' : 'Plantilla creada')
              }} className="px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                {editing ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
