import React, { useState } from 'react';
import { Stethoscope, PhoneCall, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { api } from '../services/api';
import type { TriajeResultado } from '../types';

interface Props {
  uuid: string;
}

const CHIPS_SINTOMAS = [
  'Dolor de pecho',
  'Dificultad para respirar',
  'Mareo intenso',
  'Fiebre alta (>38.5°C)',
  'Dolor de cabeza pulsátil',
  'Náuseas o vómito',
  'Visión borrosa',
  'Sarpullido repentino'
];

export const TriajeForm: React.FC<Props> = ({ uuid }) => {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [textoLibre, setTextoLibre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<TriajeResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleChip = (chip: string) => {
    setSeleccionados((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleEvaluar = async (e: React.FormEvent) => {
    e.preventDefault();
    const combinados = [...seleccionados, textoLibre.trim()].filter(Boolean).join(', ');
    if (!combinados) return;

    setCargando(true);
    setError(null);
    try {
      const res = await api.evaluarTriaje(uuid, combinados);
      setResultado(res);
    } catch {
      setError('No se pudo conectar con el motor de triaje. Si tienes síntomas graves, llama al 911.');
    } finally {
      setCargando(false);
    }
  };

  const estilosSemaforo = {
    Rojo: {
      bg: 'bg-red-600 text-white border-red-800',
      badge: 'bg-white text-red-700',
      titulo: 'URGENCIA ALTA (SEMÁFORO ROJO)'
    },
    Amarillo: {
      bg: 'bg-amber-50 border-amber-400 text-amber-950',
      badge: 'bg-amber-500 text-white',
      titulo: 'ATENCIÓN PRONTA (SEMÁFORO AMARILLO)'
    },
    Verde: {
      bg: 'bg-emerald-50 border-emerald-400 text-emerald-950',
      badge: 'bg-emerald-600 text-white',
      titulo: 'CUIDADO EN CASA / OBSERVACIÓN (VERDE)'
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <Stethoscope className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-bold">Triaje Clínico Asistido por IA</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Evalúa tus síntomas actuales considerando tus alergias y medicamentos registrados en bitácora.
        </p>

        <form onSubmit={handleEvaluar} className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
              Síntomas Frecuentes (Toca para seleccionar)
            </label>
            <div className="flex flex-wrap gap-2">
              {CHIPS_SINTOMAS.map((chip) => {
                const activo = seleccionados.includes(chip);
                return (
                  <button
                    type="button"
                    key={chip}
                    onClick={() => toggleChip(chip)}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      activo
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-600">
              Describe qué sientes y desde cuándo
            </label>
            <textarea
              rows={3}
              value={textoLibre}
              onChange={(e) => setTextoLibre(e.target.value)}
              placeholder="Ej. Siento presión ligera en el pecho desde hace 20 minutos después de subir escaleras..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-red-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={cargando || (seleccionados.length === 0 && !textoLibre.trim())}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {cargando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Analizando signos e interacciones...
              </>
            ) : (
              'Evaluar Nivel de Urgencia'
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {resultado && (
        <div
          className={`rounded-2xl border-2 p-5 shadow-md ${
            estilosSemaforo[resultado.nivel_semaforo].bg
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                estilosSemaforo[resultado.nivel_semaforo].badge
              }`}
            >
              {estilosSemaforo[resultado.nivel_semaforo].titulo}
            </span>
          </div>

          {resultado.nivel_semaforo === 'Rojo' && (
            <a
              href="tel:911"
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-lg font-black text-red-700 shadow-lg transition hover:bg-red-50"
            >
              <PhoneCall className="h-6 w-6 animate-bounce" />
              LLAMAR AL 911 AHORA
            </a>
          )}

          {resultado.posible_interaccion && (
            <div
              className={`mt-4 rounded-xl p-3 text-sm ${
                resultado.nivel_semaforo === 'Rojo'
                  ? 'bg-red-700/60 text-white'
                  : 'bg-white/80 text-slate-900'
              }`}
            >
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4" /> Cruce con Medicamentos / Historial:
              </p>
              <p className="mt-1">{resultado.posible_interaccion}</p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-bold uppercase opacity-80">Pasos Inmediatos Recomendados</p>
            <ul className="mt-2 space-y-2">
              {resultado.pasos_inmediatos.map((paso, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm font-medium">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{paso}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 border-t border-current/20 pt-3 text-xs opacity-90">
            {resultado.aviso_medico}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p>
          <strong>Aviso Médico:</strong> Este sistema provee orientación preventiva y no sustituye una valoración médica presencial ni emite recetas.
        </p>
      </div>
    </div>
  );
};