import React, { useState } from 'react';
import { FolderPlus, Calendar, FileCheck2, ExternalLink, Loader2 } from 'lucide-react';
import { api, API_URL } from '../services/api';
import type { EstudioItem } from '../types';

interface Props {
  uuid: string;
  estudios: EstudioItem[];
  onRefresh: () => Promise<void>;
}

export const EstudiosVault: React.FC<Props> = ({ uuid, estudios, onRefresh }) => {
  const [tipo, setTipo] = useState<'estudio' | 'cita' | 'vacuna'>('estudio');
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const handleSubir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !fecha) return;

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('tipo', tipo);
      formData.append('titulo', titulo.trim());
      formData.append('fecha_programada', fecha);
      if (nota.trim()) formData.append('nota', nota.trim());
      if (archivo) formData.append('archivo', archivo);

      await api.subirEstudio(uuid, formData);
      setTitulo('');
      setFecha('');
      setNota('');
      setArchivo(null);
      await onRefresh();
    } finally {
      setSubiendo(false);
    }
  };

  const esArchivoSubido = (val: string) => val && val.startsWith('/static/');
  const esImagen = (val: string) => /\.(png|jpe?g|webp|gif)$/i.test(val);

  return (
    <div className="space-y-6">
      {/* Formulario de Subida / Recordatorio */}
      <form
        onSubmit={handleSubir}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-2 text-slate-900">
          <FolderPlus className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-bold">Bóveda de Estudios, Citas y Vacunas</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'estudio' | 'cita' | 'vacuna')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium"
          >
            <option value="estudio">Estudio / Laboratorio</option>
            <option value="cita">Cita Médica</option>
            <option value="vacuna">Vacuna</option>
          </select>

          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Química Sanguínea / Cardiólogo"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">Fecha Programada</label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              Adjuntar PDF o Imagen (Opcional)
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:font-bold file:text-white"
            />
          </div>
        </div>

        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota adicional (ej. Acudir con 8 horas de ayuno)"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={subiendo}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
          Guardar en Bóveda
        </button>
      </form>

      {/* Listado y Previsualización Embebida */}
      <div className="space-y-4">
        {estudios.map((est) => {
          const tieneArchivo = esArchivoSubido(est.archivo_url_o_nota);
          const fullFileUrl = tieneArchivo ? `${API_URL}${est.archivo_url_o_nota}` : '';

          return (
            <div
              key={est.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-700">
                    {est.tipo}
                  </span>
                  <h3 className="mt-1 font-bold text-slate-900">{est.titulo}</h3>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" /> {est.fecha_programada}
                  </p>
                </div>

                {tieneArchivo && (
                  <a
                    href={fullFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Abrir <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {!tieneArchivo && est.archivo_url_o_nota && (
                <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                  {est.archivo_url_o_nota}
                </p>
              )}

              {tieneArchivo && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {esImagen(est.archivo_url_o_nota) ? (
                    <img
                      src={fullFileUrl}
                      alt={est.titulo}
                      className="max-h-64 w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={fullFileUrl}
                      title={est.titulo}
                      className="h-64 w-full"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};