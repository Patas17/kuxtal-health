import React, { useEffect, useState, useCallback } from 'react';
import { QrCode, Stethoscope, ClipboardCheck, FolderHeart, WifiOff, RefreshCw } from 'lucide-react';
import { api, DEMO_UUID } from '../services/api';
import { db } from '../db/dexie';
import type { UsuarioPerfil, BitacoraItem, EstudioItem } from '../types';
import { QRCard } from '../components/QRCard';
import { TriajeForm } from '../components/TriajeForm';
import { BitacoraList } from '../components/BitacoraList';
import { EstudiosVault } from '../components/EstudiosVault';

type TabKey = 'qr' | 'triaje' | 'bitacora' | 'estudios';

export const Dashboard: React.FC = () => {
  const [tabActiva, setTabActiva] = useState<TabKey>('qr');
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [bitacora, setBitacora] = useState<BitacoraItem[]>([]);
  const [estudios, setEstudios] = useState<EstudioItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendientesSync, setPendientesSync] = useState(0);

  const actualizarContadorCola = useCallback(async () => {
    const count = await db.syncQueue.where('usuario_id').equals(DEMO_UUID).count();
    setPendientesSync(count);
  }, []);

  const cargarTodo = useCallback(async () => {
    const [p, b, e] = await Promise.all([
      api.getPerfil(DEMO_UUID),
      api.getBitacora(DEMO_UUID),
      api.getEstudios(DEMO_UUID)
    ]);
    setPerfil(p);
    setBitacora(b);
    setEstudios(e);
    await actualizarContadorCola();
  }, [actualizarContadorCola]);

  useEffect(() => {
    cargarTodo();

    const handleOnline = async () => {
      setIsOnline(true);
      await api.flushSyncQueue(DEMO_UUID).catch(() => {});
      await cargarTodo();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [cargarTodo]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'qr', label: 'Botón Vida', icon: <QrCode className="h-4 w-4" /> },
    { key: 'triaje', label: 'Triaje IA', icon: <Stethoscope className="h-4 w-4" /> },
    { key: 'bitacora', label: 'Bitácora', icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: 'estudios', label: 'Estudios', icon: <FolderHeart className="h-4 w-4" /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Navbar Principal */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 font-black text-white">
              K
            </div>
            <div>
              <h1 className="text-base font-extrabold leading-none text-slate-900">
                Kuxtal Health
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Ecosistema Clínico Offline-First
              </p>
            </div>
          </div>

          {/* Indicador de Conectividad y Cola Offline */}
          <div className="flex items-center gap-2">
            {(!isOnline || pendientesSync > 0) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                {!isOnline ? (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-amber-700" />
                    Modo Offline {pendientesSync > 0 ? `(${pendientesSync})` : ''}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-700" />
                    Sincronizando ({pendientesSync})
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Navegación por 4 Pestañas */}
        <nav className="mx-auto grid max-w-3xl grid-cols-4 border-t border-slate-100 px-2">
          {tabs.map((t) => {
            const active = tabActiva === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTabActiva(t.key)}
                className={`flex flex-col items-center justify-center gap-1 border-b-2 py-2.5 text-xs font-bold transition sm:flex-row sm:gap-2 ${
                  active
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Contenido Dinámico de Pestañas */}
      <main className="mx-auto max-w-3xl px-4 pt-6">
        {!perfil ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando ficha clínica...
          </div>
        ) : (
          <>
            {tabActiva === 'qr' && (
              <QRCard perfil={perfil} onPerfilActualizado={setPerfil} />
            )}
            {tabActiva === 'triaje' && <TriajeForm uuid={perfil.id} />}
            {tabActiva === 'bitacora' && (
              <BitacoraList
                uuid={perfil.id}
                items={bitacora}
                onRefresh={async () => setBitacora(await api.getBitacora(perfil.id))}
                onQueueChange={actualizarContadorCola}
              />
            )}
            {tabActiva === 'estudios' && (
              <EstudiosVault
                uuid={perfil.id}
                estudios={estudios}
                onRefresh={async () => setEstudios(await api.getEstudios(perfil.id))}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};