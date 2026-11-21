import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  FileText,
  Pill,
  Activity,
  CloudOff,
  X,
  Loader2,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import type { BitacoraItem, ResumenClinico } from '../types';

interface Props {
  uuid: string;
  items: BitacoraItem[];
  onRefresh: () => Promise<void>;
  onQueueChange: () => Promise<void>;
}

export const BitacoraList: React.FC<Props> = ({ uuid, items, onRefresh, onQueueChange }) => {
  const [tipo, setTipo] = useState<'medicamento' | 'sintoma'>('medicamento');
  const [descripcion, setDescripcion] = useState('');
  const [dosis, setDosis] = useState('');
  const [horario, setHorario] = useState('08:00');
  const [guardando, setGuardando] = useState(false);

  // Estado Modal Resumen Clínico
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [resumen, setResumen] = useState<ResumenClinico | null>(null);

  const handleAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) return;

    setGuardando(true);
    try {
      await api.addBitacora(uuid, {
        tipo,
        descripcion: descripcion.trim(),
        dosis_o_intensidad: dosis.trim() || (tipo === 'medicamento' ? '1 toma' : 'Moderado'),
        horario_alerta: tipo === 'medicamento' ? horario : undefined,
        cumplido: tipo === 'sintoma'
      });
      setDescripcion('');
      setDosis('');
      await onRefresh();
      await onQueueChange();
    } finally {
      setGuardando(false);
    }
  };

  const handleToggle = async (item: BitacoraItem) => {
    await api.toggleBitacora(uuid, item);
    await onRefresh();
    await onQueueChange();
  };

  const abrirResumenMedico = async () => {
    setModalAbierto(true);
    setCargandoResumen(true);
    try {
      const data = await api.getResumenClinico(uuid);
      setResumen(data);
    } catch {
      setResumen(null);
    } finally {
      setCargandoResumen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado con Botón Resumen Médico */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bitácora de Adherencia y Síntomas</h2>
          <p className="text-xs text-slate-500">Funciona 100% sin conexión con sincronización automática</p>
        </div>
        <button
          onClick={abrirResumenMedico}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
        >
          <FileText className="h-4 w-4 text-emerald-400" />
          Generar Resumen Médico
        </button>
      </div>

      {/* Formulario Rápido */}
      <form
        onSubmit={handleAgregar}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTipo('medicamento')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold ${
              tipo === 'medicamento' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Pill className="h-4 w-4" /> Medicamento
          </button>
          <button
            type="button"
            onClick={() => setTipo('sintoma')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold ${
              tipo === 'sintoma' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Activity className="h-4 w-4" /> Síntoma / Signo
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            required
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === 'medicamento' ? 'Ej. Losartán' : 'Ej. Presión arterial 135/85'}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2 focus:border-red-600 focus:outline-none"
          />
          <input
            type="text"
            value={dosis}
            onChange={(e) => setDosis(e.target.value)}
            placeholder={tipo === 'medicamento' ? 'Dosis (50mg)' : 'Intensidad (Leve)'}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-red-600 focus:outline-none"
          />
        </div>

        {tipo === 'medicamento' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Horario sugerido:</span>
            <input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Registrar en Bitácora
        </button>
      </form>

      {/* Checklist de Registros */}
      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <div
            key={item.id ?? item.local_id ?? idx}
            onClick={() => handleToggle(item)}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              item.cumplido
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {item.cumplido ? (
                <CheckSquare className="h-6 w-6 shrink-0 text-emerald-600" />
              ) : (
                <Square className="h-6 w-6 shrink-0 text-slate-400" />
              )}
              <div>
                <p
                  className={`font-bold ${
                    item.cumplido ? 'text-slate-500 line-through' : 'text-slate-900'
                  }`}
                >
                  {item.descripcion}
                </p>
                <p className="text-xs text-slate-500">
                  {item.tipo === 'medicamento' ? '💊' : '🩺'} {item.dosis_o_intensidad}
                  {item.horario_alerta ? ` • ${item.horario_alerta} hrs` : ''}
                </p>
              </div>
            </div>

            {item.pendiente_sync && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                <CloudOff className="h-3 w-3" /> Local
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Modal Resumen Clínico para Consulta */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">Resumen Clínico Estructurado</h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {cargandoResumen ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                <p className="mt-3 text-sm font-medium">Sintetizando adherencia y triajes con IA...</p>
              </div>
            ) : resumen ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Adherencia Terapéutica</p>
                    <p className="text-2xl font-black text-emerald-400">
                      {Math.round(resumen.adherencia_porcentaje)}%
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
                  >
                    <Printer className="h-4 w-4" /> Imprimir
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500">Resumen Ejecutivo</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">
                    {resumen.resumen_ejecutivo}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500">
                    Puntos Clave para el Médico
                  </h4>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-800">
                    {resumen.puntos_clave_consulta.map((punto, idx) => (
                      <li key={idx}>{punto}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-red-600">
                Requiere conexión a internet para generar el resumen ejecutivo con IA.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};