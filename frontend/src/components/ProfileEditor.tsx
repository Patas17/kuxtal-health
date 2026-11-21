import React, { useState } from 'react';
import { UserCog, Save, X, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import type { UsuarioPerfil } from '../types';

interface Props {
  perfil: UsuarioPerfil;
  onGuardado: (actualizado: UsuarioPerfil) => void;
  onCerrar: () => void;
}

export const ProfileEditor: React.FC<Props> = ({ perfil, onGuardado, onCerrar }) => {
  const [formData, setFormData] = useState<UsuarioPerfil>({ ...perfil });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await api.updatePerfil(perfil.id, formData);
      onGuardado(res);
      onCerrar();
    } catch {
      setError('No se pudo actualizar el perfil. Verifica tu conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-slate-900">
            <UserCog className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-extrabold">Editar Ficha Vital</h3>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600">Nombre Completo</label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600">Edad</label>
              <input
                type="number"
                required
                min={0}
                max={130}
                value={formData.edad}
                onChange={(e) => setFormData({ ...formData, edad: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600">Tipo de Sangre</label>
              <input
                type="text"
                required
                placeholder="Ej. O+, A+, B-"
                value={formData.tipo_sangre}
                onChange={(e) => setFormData({ ...formData, tipo_sangre: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600">Alergias Severas</label>
            <input
              type="text"
              placeholder="Ej. Penicilina, Mariscos, Ninguna"
              value={formData.alergias}
              onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600">Condiciones Crónicas</label>
            <input
              type="text"
              placeholder="Ej. Hipertensión, Diabetes tipo 2"
              value={formData.condiciones_cronicas}
              onChange={(e) => setFormData({ ...formData, condiciones_cronicas: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600">Medicamentos Activos</label>
            <input
              type="text"
              placeholder="Ej. Losartán 50mg, Metformina 850mg"
              value={formData.medicamentos_activos || ''}
              onChange={(e) => setFormData({ ...formData, medicamentos_activos: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600">Contacto de Emergencia</label>
              <input
                type="text"
                required
                placeholder="Nombre del contacto"
                value={formData.contacto_emergencia_nombre}
                onChange={(e) => setFormData({ ...formData, contacto_emergencia_nombre: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600">Teléfono Contacto</label>
              <input
                type="tel"
                required
                placeholder="10 dígitos"
                value={formData.contacto_emergencia_tel}
                onChange={(e) => setFormData({ ...formData, contacto_emergencia_tel: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
