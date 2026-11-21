import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  PhoneCall,
  MapPin,
  AlertTriangle,
  ShieldAlert,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { api, decodeVitalData, DEMO_UUID } from '../services/api';
import type { UsuarioPerfil, AuxilioResultado } from '../types';

const EVENTOS_RAPIDOS = [
  'Inconsciente',
  'Dificultad para respirar',
  'Reacción alérgica',
  'Golpe de calor / Desmayo'
];

export const EmergencyView: React.FC = () => {
  const { uuid = DEMO_UUID } = useParams();
  const [searchParams] = useSearchParams();

  // 1. Hidratación inmediata (0 ms) desde el parámetro ?data= del QR
  const [perfil, setPerfil] = useState<Partial<UsuarioPerfil> | null>(() => {
    const raw = searchParams.get('data');
    return raw ? decodeVitalData(raw) : null;
  });

  const [modoOffline, setModoOffline] = useState(!navigator.onLine);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [obteniendoGps, setObteniendoGps] = useState(false);
  const [eventoActivo, setEventoActivo] = useState<string | null>(null);
  const [auxilio, setAuxilio] = useState<AuxilioResultado | null>(null);
  const [cargandoAuxilio, setCargandoAuxilio] = useState(false);

  // Helper para solicitar GPS bajo demanda con promesa
  const obtenerPosicionGps = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  useEffect(() => {
    // Intento anticipado de captura GPS al abrir la vista
    obtenerPosicionGps().then((pos) => {
      if (pos) setCoords(pos);
    });

    // Intentar enriquecer con datos frescos del servidor si hay red
    api
      .getPerfil(uuid)
      .then((fresh) => {
        setPerfil(fresh);
        setModoOffline(false);
      })
      .catch(() => {
        setModoOffline(true);
      });
  }, [uuid]);

  const consultarAuxilio = async (evento: string) => {
    setEventoActivo(evento);
    setCargandoAuxilio(true);
    try {
      const res = await api.getAuxilioEmergencia(
        uuid,
        evento,
        coords?.lat ?? null,
        coords?.lng ?? null
      );
      setAuxilio(res);
    } catch {
      setAuxilio(null);
    } finally {
      setCargandoAuxilio(false);
    }
  };

  const handleAlertaWhatsApp = async () => {
    setObteniendoGps(true);
    let ubicacion = coords;

    // Si aún no tenemos la ubicación, solicitarla en tiempo real al tocar el botón
    if (!ubicacion) {
      ubicacion = await obtenerPosicionGps();
      if (ubicacion) {
        setCoords(ubicacion);
      }
    }
    setObteniendoGps(false);

    let tel = (perfil?.contacto_emergencia_tel || '').replace(/\D/g, '');
    // Si tiene 10 dígitos (formato estándar México / local), añadir prefijo internacional 52
    if (tel.length === 10) {
      tel = `52${tel}`;
    }

    const mapsLink = ubicacion
      ? `https://maps.google.com/?q=${ubicacion.lat},${ubicacion.lng}`
      : 'Ubicación GPS no disponible (permiso denegado)';

    const texto = encodeURIComponent(
      `🚨 EMERGENCIA MÉDICA KUXTAL (${perfil?.nombre || 'Paciente'}). Ubicación en tiempo real: ${mapsLink}`
    );

    const url = `https://wa.me/${tel}?text=${texto}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-12">
      {/* Barra Superior de Alto Contraste */}
      <header className="bg-red-600 px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-white" />
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">
                Emergencia Médica
              </h1>
              <p className="text-xs font-medium text-red-100">Kuxtal Health • Respuesta Rápida</p>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-lg bg-red-800/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> App
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
        {modoOffline && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/70 px-4 py-2.5 text-xs font-semibold text-amber-200">
            <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
            Sin conexión a internet: mostrando datos vitales incrustados en el QR.
          </div>
        )}

        {/* Botones de Acción Inmediata (911 + Alerta GPS WhatsApp) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="tel:911"
            className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
          >
            <PhoneCall className="h-7 w-7" />
            LLAMAR AL 911
          </a>

          {perfil?.contacto_emergencia_tel && (
            <button
              type="button"
              disabled={obteniendoGps}
              onClick={handleAlertaWhatsApp}
              className="flex min-h-16 items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-4 text-center text-sm font-black text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-75"
            >
              {obteniendoGps ? (
                <>
                  <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                  <span>OBTENIENDO GPS...</span>
                </>
              ) : (
                <>
                  <MapPin className="h-6 w-6 shrink-0" />
                  <span>ALERTA GPS A {perfil.contacto_emergencia_nombre?.toUpperCase() || 'CONTACTO'}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Ficha Vital Crítica */}
        {perfil ? (
          <section className="rounded-2xl border-2 border-white/20 bg-white p-5 text-slate-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Paciente</p>
                <h2 className="text-2xl font-black">{perfil.nombre}</h2>
                <p className="text-sm font-semibold text-slate-600">{perfil.edad} años</p>
              </div>
              <div className="rounded-2xl bg-red-600 px-4 py-2.5 text-center text-white">
                <p className="text-[10px] font-bold uppercase">Tipo Sangre</p>
                <p className="text-3xl font-black">{perfil.tipo_sangre}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border-2 border-red-600 bg-red-50 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase text-red-700">
                  <AlertTriangle className="h-4 w-4" /> Alergias Severas
                </p>
                <p className="mt-1 text-lg font-extrabold text-red-950">
                  {perfil.alergias || 'Ninguna registrada'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-100 p-3.5">
                  <p className="text-xs font-bold uppercase text-slate-500">Condiciones Crónicas</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {perfil.condiciones_cronicas || 'Ninguna'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3.5">
                  <p className="text-xs font-bold uppercase text-slate-500">Medicación Activa</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {perfil.medicamentos_activos || 'Ninguna'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-2xl bg-slate-900 p-6 text-center text-slate-300">
            No se encontraron datos vitales para este identificador.
          </div>
        )}

        {/* Asistente de Primeros Auxilios Contextuales IA */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-base font-extrabold text-white">
            Guía de Primeros Auxilios Contextuales (IA)
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Selecciona qué está ocurriendo para recibir instrucciones adaptadas a las alergias y condiciones del paciente:
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {EVENTOS_RAPIDOS.map((ev) => (
              <button
                key={ev}
                disabled={modoOffline || cargandoAuxilio}
                onClick={() => consultarAuxilio(ev)}
                className={`min-h-12 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                  eventoActivo === ev
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-40'
                }`}
              >
                {ev}
              </button>
            ))}
          </div>

          {cargandoAuxilio && (
            <div className="mt-5 flex items-center justify-center gap-2 py-6 text-sm text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-red-500" />
              Generando protocolo seguro para {perfil?.nombre}...
            </div>
          )}

          {auxilio && !cargandoAuxilio && (
            <div className="mt-5 space-y-4 border-t border-slate-800 pt-4">
              <div className="rounded-xl bg-amber-500/20 border border-amber-500/40 p-3 text-xs font-bold text-amber-200">
                ⚠️ {auxilio.nota_critica}
              </div>

              <div className="rounded-xl bg-emerald-950/60 border border-emerald-700/50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-400">
                  <CheckCircle className="h-4 w-4" /> QUÉ HACER AHORA
                </p>
                <ul className="mt-2 space-y-2 text-sm text-emerald-50">
                  {auxilio.hacer.map((h, i) => (
                    <li key={i}>• {h}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-red-950/60 border border-red-700/50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase text-red-400">
                  <XCircle className="h-4 w-4" /> QUÉ EVITAR
                </p>
                <ul className="mt-2 space-y-2 text-sm text-red-50">
                  {auxilio.evitar.map((ev, i) => (
                    <li key={i}>• {ev}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};