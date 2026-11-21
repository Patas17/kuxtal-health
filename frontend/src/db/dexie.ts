import Dexie, { type Table } from 'dexie';
import type { UsuarioPerfil, BitacoraItem, EstudioItem, SyncQueueItem } from '../types';

export class KuxtalDatabase extends Dexie {
  perfil!: Table<UsuarioPerfil, string>;
  bitacora!: Table<BitacoraItem, number>;
  estudios!: Table<EstudioItem, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('KuxtalHealthDB');
    this.version(1).stores({
      perfil: 'id',
      bitacora: '++id, local_id, usuario_id, tipo, fecha_registro',
      estudios: 'id, usuario_id, tipo, fecha_programada',
      syncQueue: '++id, usuario_id, accion, timestamp'
    });
  }
}

export const db = new KuxtalDatabase();