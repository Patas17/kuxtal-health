from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field


def get_utc_now() -> datetime:
    """Retorna la fecha y hora actual en UTC."""
    return datetime.now(timezone.utc)


# ==========================================
# 1. TABLAS DE BASE DE DATOS (SQLModel)
# ==========================================

class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"

    id: str = Field(primary_key=True, description="UUID determinístico o generado del usuario")
    nombre: str
    edad: int
    tipo_sangre: str
    alergias: str
    condiciones_cronicas: str
    medicamentos_activos: str
    contacto_emergencia_nombre: str
    contacto_emergencia_tel: str


class TratamientoBitacora(SQLModel, table=True):
    __tablename__ = "tratamientos_bitacora"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: str = Field(foreign_key="usuarios.id", index=True)
    tipo: str = Field(description="'medicamento' o 'sintoma'")
    descripcion: str
    dosis_o_intensidad: str
    horario_alerta: Optional[str] = Field(default=None)
    cumplido: bool = Field(default=False)
    fecha_registro: datetime = Field(default_factory=get_utc_now)


class Triaje(SQLModel, table=True):
    __tablename__ = "triajes"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: str = Field(foreign_key="usuarios.id", index=True)
    sintomas_actuales: str
    nivel_semaforo: str = Field(description="'Rojo', 'Amarillo' o 'Verde'")
    guia_primeros_pasos: str = Field(description="JSON estructurado con pasos y señales de alarma")
    fecha: datetime = Field(default_factory=get_utc_now)


class HistorialEstudios(SQLModel, table=True):
    __tablename__ = "historial_estudios"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: str = Field(foreign_key="usuarios.id", index=True)
    tipo: str = Field(description="'estudio', 'cita' o 'vacuna'")
    titulo: str
    fecha_programada: str
    archivo_url_o_nota: Optional[str] = Field(default=None)


# ==========================================
# 2. ESQUEMAS PYDANTIC / DTOs (API Request / Response)
# ==========================================

# --- Perfil ---
class PerfilUpdate(SQLModel):
    nombre: Optional[str] = None
    edad: Optional[int] = None
    tipo_sangre: Optional[str] = None
    alergias: Optional[str] = None
    condiciones_cronicas: Optional[str] = None
    medicamentos_activos: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_tel: Optional[str] = None


class EmergenciaPerfilResponse(SQLModel):
    """Respuesta pública para la vista SOS con datos vitales."""
    id: str
    nombre: str
    edad: int
    tipo_sangre: str
    alergias: str
    condiciones_cronicas: str
    medicamentos_activos: str
    contacto_emergencia_nombre: str
    contacto_emergencia_tel: str


# --- Bitácora de Tratamientos ---
class BitacoraCreate(SQLModel):
    tipo: str
    descripcion: str
    dosis_o_intensidad: str
    horario_alerta: Optional[str] = None
    cumplido: bool = False
    fecha_registro: Optional[datetime] = None


class BitacoraUpdate(SQLModel):
    cumplido: Optional[bool] = None
    descripcion: Optional[str] = None
    dosis_o_intensidad: Optional[str] = None
    horario_alerta: Optional[str] = None


class BitacoraSyncItem(SQLModel):
    id: Optional[int] = None
    tipo: str
    descripcion: str
    dosis_o_intensidad: str
    horario_alerta: Optional[str] = None
    cumplido: bool = False
    fecha_registro: Optional[datetime] = None


class SyncRequest(SQLModel):
    items: List[BitacoraSyncItem]


# --- Triaje e Inteligencia Artificial ---
class TriajeRequest(SQLModel):
    sintomas: str


class TriajeDetalle(SQLModel):
    nivel_semaforo: str
    posible_interaccion: str
    pasos_inmediatos: List[str]
    senales_alarma: List[str]
    aviso_legal: str


class TriajeResponse(SQLModel):
    id: Optional[int] = None
    usuario_id: str
    sintomas_actuales: str
    nivel_semaforo: str
    posible_interaccion: Optional[str] = None
    pasos_inmediatos: Optional[List[str]] = None
    senales_alarma: Optional[List[str]] = None
    aviso_legal: Optional[str] = None
    aviso_medico: Optional[str] = None
    guia: Optional[TriajeDetalle] = None
    fecha: datetime


class EmergenciaAuxilioRequest(SQLModel):
    evento: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class EmergenciaAuxilioResponse(SQLModel):
    hacer: List[str]
    evitar: List[str]
    alerta_critica: str
    nota_critica: Optional[str] = None


class ResumenClinicoResponse(SQLModel):
    resumen_ejecutivo: str
    porcentaje_adherencia: float
    hallazgos_clave: List[str]
    adherencia_porcentaje: Optional[float] = None
    puntos_clave_consulta: Optional[List[str]] = None


# --- Estudios ---
class EstudioCreate(SQLModel):
    tipo: str
    titulo: str
    fecha_programada: str
    archivo_url_o_nota: Optional[str] = None
