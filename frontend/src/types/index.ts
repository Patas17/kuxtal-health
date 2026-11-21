export interface UsuarioPerfil {
  id: string;
  nombre: string;
  edad: number;
  tipo_sangre: string;
  alergias: string;
  condiciones_cronicas: string;
  medicamentos_activos?: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_tel: string;
}

export interface BitacoraItem {
  id?: number;
  local_id?: string;
  usuario_id: string;
  tipo: 'medicamento' | 'sintoma';
  descripcion: string;
  dosis_o_intensidad: string;
  horario_alerta?: string;
  cumplido: boolean;
  fecha_registro: string;
  pendiente_sync?: boolean;
}

export interface TriajeResultado {
  nivel_semaforo: 'Rojo' | 'Amarillo' | 'Verde';
  posible_interaccion: string;
  pasos_inmediatos: string[];
  aviso_medico: string;
}

export interface AuxilioResultado {
  hacer: string[];
  evitar: string[];
  nota_critica: string;
}

export interface ResumenClinico {
  resumen_ejecutivo: string;
  adherencia_porcentaje: number;
  puntos_clave_consulta: string[];
}

export interface EstudioItem {
  id: number;
  usuario_id: string;
  tipo: 'estudio' | 'cita' | 'vacuna';
  titulo: string;
  fecha_programada: string;
  archivo_url_o_nota: string;
}

export interface SyncQueueItem {
  id?: number;
  usuario_id: string;
  accion: 'CREATE_BITACORA' | 'TOGGLE_BITACORA';
  payload: Partial<BitacoraItem>;
  timestamp: string;
}