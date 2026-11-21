import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ShieldAlert, Download, ExternalLink, HeartPulse, Phone, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UsuarioPerfil } from '../types';
import { encodeVitalData } from '../services/api';

interface Props {
  perfil: UsuarioPerfil;
}

export const QRCard: React.FC<Props> = ({ perfil }) => {
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const encodedData = encodeVitalData(perfil);
  const sosRelativeUrl = `/sos/${perfil.id}?data=${encodedData}`;
  const sosFullUrl = `${window.location.origin}${sosRelativeUrl}`;

  const descargarLockscreenPNG = () => {
    const sourceCanvas = qrWrapperRef.current?.querySelector('canvas');
    if (!sourceCanvas) return;

    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo blanco limpio
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Encabezado rojo de emergencia
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, canvas.width, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMERGENCIA MÉDICA', canvas.width / 2, 85);
    ctx.font = '26px sans-serif';
    ctx.fillText('KUXTAL HEALTH • FICHA VITAL', canvas.width / 2, 135);

    // Nombre y Tipo de Sangre
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(perfil.nombre, canvas.width / 2, 260);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(`SANGRE: ${perfil.tipo_sangre}`, canvas.width / 2, 335);

    // Alergias críticas
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`ALERGIAS: ${perfil.alergias || 'Ninguna conocida'}`, canvas.width / 2, 395);

    // Dibujar QR centrado
    const qrSize = 440;
    ctx.drawImage(sourceCanvas, (canvas.width - qrSize) / 2, 445, qrSize, qrSize);

    // Pie de página
    ctx.fillStyle = '#334155';
    ctx.font = '26px sans-serif';
    ctx.fillText('Escanea con la cámara (Funciona sin Internet)', canvas.width / 2, 955);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`Tel. Emergencia: ${perfil.contacto_emergencia_tel}`, canvas.width / 2, 1005);

    const link = document.createElement('a');
    link.download = `Kuxtal_SOS_${perfil.nombre.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta Vital de Alto Contraste */}
      <div className="rounded-2xl border-2 border-red-600 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase text-red-700">
              <HeartPulse className="h-3.5 w-3.5" /> Ficha Vital Activa
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{perfil.nombre}</h2>
            <p className="text-sm text-slate-500">{perfil.edad} años</p>
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-red-600 text-white shadow">
            <span className="text-[10px] font-semibold uppercase">Sangre</span>
            <span className="text-2xl font-black">{perfil.tipo_sangre}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-red-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-red-800">
              <AlertTriangle className="h-4 w-4" /> Alergias Críticas
            </p>
            <p className="mt-1 font-semibold text-red-950">{perfil.alergias || 'Ninguna'}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-3">
            <p className="text-xs font-bold uppercase text-slate-600">Condiciones y Medicación</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {perfil.condiciones_cronicas} {perfil.medicamentos_activos ? `• ${perfil.medicamentos_activos}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 text-red-400" />
            <div>
              <p className="text-xs text-slate-400">Contacto de Emergencia</p>
              <p className="text-sm font-bold">
                {perfil.contacto_emergencia_nombre} ({perfil.contacto_emergencia_tel})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor QR Híbrido */}
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-slate-800">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <h3 className="font-bold">Código QR Híbrido (Online + Offline)</h3>
        </div>
        <p className="mb-5 max-w-md text-xs text-slate-500">
          Este QR incrusta tus datos vitales codificados en la URL. Si un paramédico lo escanea sin señal celular, la ficha cargará al instante.
        </p>

        <div ref={qrWrapperRef} className="rounded-2xl border-4 border-slate-900 bg-white p-4 shadow-inner">
          <QRCodeCanvas value={sosFullUrl} size={220} level="M" includeMargin />
        </div>

        <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <button
            onClick={descargarLockscreenPNG}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Descargar Pantalla Bloqueo
          </button>

          <Link
            to={sosRelativeUrl}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
          >
            <ExternalLink className="h-4 w-4" />
            Probar Vista SOS
          </Link>
        </div>
      </div>
    </div>
  );
};