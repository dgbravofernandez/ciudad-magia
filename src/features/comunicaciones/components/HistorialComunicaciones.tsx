'use client'
import { Mail, Users, Clock, CheckCircle, XCircle, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState } from 'react'

interface Communication {
  id: string
  subject: string
  body: string
  sent_at: string | null
  status: string
  communication_recipients?: { count: number }[]
}

interface Props { communications: Communication[] }

export function HistorialComunicaciones({ communications }: Props) {
  const [selected, setSelected] = useState<Communication | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historial de comunicaciones</h1>
        <p className="text-sm text-gray-500">{communications.length} correos enviados</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {communications.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No hay comunicaciones aún</p>
          </div>
        )}
        {communications.map((comm) => (
          <div key={comm.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{comm.subject}</p>
              <div className="flex items-center gap-3 mt-0.5">
                {comm.sent_at && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(comm.sent_at), "d MMM yyyy HH:mm", { locale: es })}
                  </span>
                )}
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {comm.communication_recipients?.[0]?.count ?? 0} destinatarios
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {comm.status === 'sent' ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Enviado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" /> Borrador
                </span>
              )}
              <button onClick={() => setSelected(comm)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{selected.subject}</h3>
              {selected.sent_at && (
                <p className="text-sm text-gray-500 mt-1">
                  Enviado el {format(new Date(selected.sent_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                </p>
              )}
            </div>
            <div className="p-6">
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{selected.body}</div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelected(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
