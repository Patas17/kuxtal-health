import { db } from '../db/dexie';
import type {
  UsuarioPerfil,
  BitacoraItem,
  TriajeResultado,
  AuxilioResultado,
  ResumenClinico,
  EstudioItem
} from '../types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const DEMO_UUID = '00000000-0000-0000-0000-000000000001';

export function encodeVitalData(perfil: UsuarioPerfil): string {
  const payload = {
    n: perfil.nombre,
    e: perfil.edad,
    s: perfil.tipo_sangre,
    a: perfil.alergias,
    c: perfil.condiciones_cronicas,
    m: perfil.medicamentos_activos || '',
    cn: perfil.contacto_emergencia_nombre,
    ct: perfil.contacto_emergencia_tel
  };
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json));
}

export function decodeVitalData(encoded: string): Partial<UsuarioPerfil> | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const data = JSON.parse(json);
    return {
      nombre: data.n,
      edad: data.e,
      tipo_sangre: data.s,
      alergias: data.a,
      condiciones_cronicas: data.c,
      medicamentos_activos: data.m,
      contacto_emergencia_nombre: data.cn,
      contacto_emergencia_tel: data.ct
    };
  } catch {
    return null;
  }
}

export const api = {
  async getPerfil(uuid: string = DEMO_UUID): Promise<UsuarioPerfil> {
    try {
      const res = await fetch(`${API_URL}/api/v1/emergencia/${uuid}`);
      if (!res.ok) throw new Error('Error obteniendo perfil');
      const data = await res.json();
      const perfil: UsuarioPerfil = data.perfil ? data.perfil : data;
      await db.perfil.put(perfil);
      return perfil;
    } catch {
      const local = await db.perfil.get(uuid);
      if (local) return local;
      throw new Error('Sin conexión y sin datos locales en caché');
    }
  },

  async getBitacora(uuid: string = DEMO_UUID): Promise<BitacoraItem[]> {
    try {
      const res = await fetch(`${API_URL}/api/v1/bitacora/${uuid}`);
      if (!res.ok) throw new Error('Error obteniendo bitácora');
      const remoteItems: BitacoraItem[] = await res.json();

      const pendientes = await db.bitacora
        .where('usuario_id')
        .equals(uuid)
        .filter((item) => Boolean(item.pendiente_sync))
        .toArray();

      await db.bitacora.where('usuario_id').equals(uuid).delete();
      if (remoteItems.length > 0) {
        await db.bitacora.bulkPut(remoteItems);
      }
      if (pendientes.length > 0) {
        const sinId = pendientes.map(({ id: _omit, ...rest }) => rest);
        await db.bitacora.bulkAdd(sinId as BitacoraItem[]);
      }
      return [...pendientes, ...remoteItems];
    } catch {
      return await db.bitacora.where('usuario_id').equals(uuid).reverse().toArray();
    }
  },

  async addBitacora(
    uuid: string,
    nuevo: Omit<BitacoraItem, 'id' | 'usuario_id' | 'fecha_registro'>
  ): Promise<{ item: BitacoraItem; offline: boolean }> {
    const itemPayload: BitacoraItem = {
      ...nuevo,
      usuario_id: uuid,
      fecha_registro: new Date().toISOString()
    };

    const guardarOffline = async () => {
      const offlineItem: BitacoraItem = {
        ...itemPayload,
        local_id: crypto.randomUUID(),
        pendiente_sync: true
      };
      const localId = await db.bitacora.add(offlineItem);
      await db.syncQueue.add({
        usuario_id: uuid,
        accion: 'CREATE_BITACORA',
        payload: { ...offlineItem, id: Number(localId) },
        timestamp: new Date().toISOString()
      });
      return { item: { ...offlineItem, id: Number(localId) }, offline: true };
    };

    if (!navigator.onLine) {
      return guardarOffline();
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/bitacora/${uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemPayload)
      });
      if (!res.ok) throw new Error('Fallo POST bitacora');
      const created: BitacoraItem = await res.json();
      await db.bitacora.put(created);
      return { item: created, offline: false };
    } catch {
      return guardarOffline();
    }
  },

  async toggleBitacora(uuid: string, item: BitacoraItem): Promise<boolean> {
    const nuevoEstado = !item.cumplido;
    if (item.id !== undefined) {
      await db.bitacora.update(item.id, { cumplido: nuevoEstado });
    }

    if (!navigator.onLine || item.pendiente_sync) {
      await db.syncQueue.add({
        usuario_id: uuid,
        accion: 'TOGGLE_BITACORA',
        payload: { id: item.id, cumplido: nuevoEstado },
        timestamp: new Date().toISOString()
      });
      return true;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/bitacora/${uuid}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cumplido: nuevoEstado })
      });
      return res.ok;
    } catch {
      await db.syncQueue.add({
        usuario_id: uuid,
        accion: 'TOGGLE_BITACORA',
        payload: { id: item.id, cumplido: nuevoEstado },
        timestamp: new Date().toISOString()
      });
      return false;
    }
  },

  async flushSyncQueue(uuid: string = DEMO_UUID): Promise<number> {
    const cola = await db.syncQueue.where('usuario_id').equals(uuid).toArray();
    if (cola.length === 0) return 0;

    const creaciones = cola
      .filter((c) => c.accion === 'CREATE_BITACORA')
      .map((c) => c.payload);

    if (creaciones.length > 0) {
      const res = await fetch(`${API_URL}/api/v1/sync/${uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: creaciones })
      });
      if (!res.ok) throw new Error('Error sincronizando lote offline');
    }

    const toggles = cola.filter((c) => c.accion === 'TOGGLE_BITACORA' && c.payload.id !== undefined);
    for (const t of toggles) {
      await fetch(`${API_URL}/api/v1/bitacora/${uuid}/${t.payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cumplido: t.payload.cumplido })
      }).catch(() => {});
    }

    await db.syncQueue.where('usuario_id').equals(uuid).delete();
    await this.getBitacora(uuid);
    return cola.length;
  },

  async evaluarTriaje(uuid: string, sintomas: string): Promise<TriajeResultado> {
    const res = await fetch(`${API_URL}/api/v1/triaje/${uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sintomas })
    });
    if (!res.ok) throw new Error('Error ejecutando triaje');
    return await res.json();
  },

  async getResumenClinico(uuid: string): Promise<ResumenClinico> {
    const res = await fetch(`${API_URL}/api/v1/resumen/${uuid}`);
    if (!res.ok) throw new Error('Error generando resumen clínico');
    return await res.json();
  },

  async getEstudios(uuid: string): Promise<EstudioItem[]> {
    try {
      const res = await fetch(`${API_URL}/api/v1/estudios/${uuid}`);
      if (!res.ok) throw new Error('Error obteniendo estudios');
      const items: EstudioItem[] = await res.json();
      await db.estudios.where('usuario_id').equals(uuid).delete();
      if (items.length > 0) await db.estudios.bulkPut(items);
      return items;
    } catch {
      return await db.estudios.where('usuario_id').equals(uuid).toArray();
    }
  },

  async subirEstudio(uuid: string, formData: FormData): Promise<EstudioItem> {
    const res = await fetch(`${API_URL}/api/v1/estudios/${uuid}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Error subiendo estudio');
    const created: EstudioItem = await res.json();
    await db.estudios.put(created);
    return created;
  },

  async getAuxilioEmergencia(
    uuid: string,
    evento: string,
    lat: number | null,
    lng: number | null
  ): Promise<AuxilioResultado> {
    const res = await fetch(`${API_URL}/api/v1/emergencia/${uuid}/auxilio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento, lat, lng })
    });
    if (!res.ok) throw new Error('Error consultando primeros auxilios IA');
    return await res.json();
  }
};