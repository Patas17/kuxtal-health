import os
import re
import json
import shutil
import uuid as py_uuid
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from database import init_db, get_session
from seed import seed_db, DEMO_USER_ID
from models import (
    Usuario,
    TratamientoBitacora,
    Triaje,
    HistorialEstudios,
    PerfilUpdate,
    EmergenciaPerfilResponse,
    BitacoraCreate,
    BitacoraUpdate,
    SyncRequest,
    TriajeRequest,
    TriajeResponse,
    TriajeDetalle,
    EmergenciaAuxilioRequest,
    EmergenciaAuxilioResponse,
    ResumenClinicoResponse,
)
import ai_service

# 1. Cargar variables de entorno
load_dotenv()

# Directorios base y uploads
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# 2. Ciclo de Vida (Lifespan)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Asegurar existencia física de uploads
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    # Inicializar tablas de SQLite
    init_db()
    # Ejecutar seed de datos demo si la base está vacía
    seed_db()
    yield


# 3. Inicialización de la Aplicación FastAPI
app = FastAPI(
    title="Kuxtal Health API",
    description="Backend para PWA de salud preventiva y respuesta ante emergencias (Offline-First + IA)",
    version="1.0.0",
    lifespan=lifespan,
)

# 4. Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Montaje de archivos estáticos
app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# Función auxiliar para nombres de archivo seguros
def limpiar_nombre_archivo(nombre: str) -> str:
    seguro = Path(nombre).name
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", seguro)


# ==========================================
# ENDPOINTS REST (/api/v1)
# ==========================================

@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Kuxtal Health Backend"}


# --- Perfil del Usuario ---

@app.get("/api/v1/perfil/demo", response_model=Usuario, tags=["Perfil"])
def obtener_perfil_demo(session: Session = Depends(get_session)):
    """Retorna el perfil del paciente demo con UUID fijo."""
    demo_user = session.get(Usuario, DEMO_USER_ID)
    if not demo_user:
        raise HTTPException(status_code=404, detail="Usuario demo no encontrado. Verifique la base de datos.")
    return demo_user


@app.put("/api/v1/perfil/{uuid}", response_model=Usuario, tags=["Perfil"])
def actualizar_perfil(uuid: str, perfil_in: PerfilUpdate, session: Session = Depends(get_session)):
    """Actualiza los campos del perfil vital del usuario especificado."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail=f"Usuario con ID {uuid} no encontrado")

    datos_actualizacion = perfil_in.model_dump(exclude_unset=True)
    for clave, valor in datos_actualizacion.items():
        setattr(usuario, clave, valor)

    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario


# --- Emergencias y SOS ---

@app.get("/api/v1/emergencia/{uuid}", response_model=EmergenciaPerfilResponse, tags=["Emergencia"])
def obtener_perfil_emergencia(uuid: str, session: Session = Depends(get_session)):
    """Endpoint público que expone exclusivamente la información vital para la vista /sos/:uuid."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Información de emergencia no encontrada")

    return EmergenciaPerfilResponse(
        id=usuario.id,
        nombre=usuario.nombre,
        edad=usuario.edad,
        tipo_sangre=usuario.tipo_sangre,
        alergias=usuario.alergias,
        condiciones_cronicas=usuario.condiciones_cronicas,
        medicamentos_activos=usuario.medicamentos_activos,
        contacto_emergencia_nombre=usuario.contacto_emergencia_nombre,
        contacto_emergencia_tel=usuario.contacto_emergencia_tel,
    )


@app.post("/api/v1/emergencia/{uuid}/auxilio", response_model=EmergenciaAuxilioResponse, tags=["Emergencia"])
def primeros_auxilios(uuid: str, req: EmergenciaAuxilioRequest, session: Session = Depends(get_session)):
    """Genera guía inmediata de primeros auxilios contextualizada al perfil y medicamentos del paciente."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    bitacora_reciente = session.exec(
        select(TratamientoBitacora)
        .where(TratamientoBitacora.usuario_id == uuid)
        .order_by(TratamientoBitacora.fecha_registro.desc())
        .limit(10)
    ).all()

    guia = ai_service.primeros_auxilios_contextuales(
        evento=req.evento,
        perfil=usuario,
        bitacora=bitacora_reciente,
    )
    if "nota_critica" not in guia and "alerta_critica" in guia:
        guia["nota_critica"] = guia["alerta_critica"]
    return guia


# --- Triaje Clínico ---

@app.post("/api/v1/triaje/{uuid}", response_model=TriajeResponse, tags=["Triaje"])
def realizar_triaje(uuid: str, req: TriajeRequest, session: Session = Depends(get_session)):
    """
    Evalúa síntomas clínicos con reglas determinísticas duras y Gemini 2.5 Flash.
    Almacena el resultado en el historial de triajes y retorna la guía completa.
    """
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    bitacora_reciente = session.exec(
        select(TratamientoBitacora)
        .where(TratamientoBitacora.usuario_id == uuid)
        .order_by(TratamientoBitacora.fecha_registro.desc())
        .limit(10)
    ).all()

    resultado_ia = ai_service.evaluar_triaje(
        sintomas=req.sintomas,
        perfil=usuario,
        bitacora=bitacora_reciente,
    )

    # Persistir en base de datos
    nuevo_triaje = Triaje(
        usuario_id=uuid,
        sintomas_actuales=req.sintomas,
        nivel_semaforo=resultado_ia.get("nivel_semaforo", "Amarillo"),
        guia_primeros_pasos=json.dumps(resultado_ia, ensure_ascii=False),
        fecha=datetime.now(timezone.utc),
    )
    session.add(nuevo_triaje)
    session.commit()
    session.refresh(nuevo_triaje)

    return TriajeResponse(
        id=nuevo_triaje.id,
        usuario_id=nuevo_triaje.usuario_id,
        sintomas_actuales=nuevo_triaje.sintomas_actuales,
        nivel_semaforo=nuevo_triaje.nivel_semaforo,
        posible_interaccion=resultado_ia.get("posible_interaccion", ""),
        pasos_inmediatos=resultado_ia.get("pasos_inmediatos", []),
        senales_alarma=resultado_ia.get("senales_alarma", []),
        aviso_legal=resultado_ia.get("aviso_legal", ""),
        aviso_medico=resultado_ia.get("aviso_legal", ""),
        guia=TriajeDetalle(**resultado_ia),
        fecha=nuevo_triaje.fecha,
    )


# --- Bitácora de Tratamientos y Síntomas ---

@app.get("/api/v1/bitacora/{uuid}", response_model=List[TratamientoBitacora], tags=["Bitácora"])
def listar_bitacora(uuid: str, session: Session = Depends(get_session)):
    """Lista todos los registros de bitácora del usuario ordenados por fecha descendente."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    registros = session.exec(
        select(TratamientoBitacora)
        .where(TratamientoBitacora.usuario_id == uuid)
        .order_by(TratamientoBitacora.fecha_registro.desc())
    ).all()
    return registros


@app.post("/api/v1/bitacora/{uuid}", response_model=TratamientoBitacora, status_code=status.HTTP_201_CREATED, tags=["Bitácora"])
def crear_registro_bitacora(uuid: str, item_in: BitacoraCreate, session: Session = Depends(get_session)):
    """Crea un registro individual de toma de medicamento o reporte de síntoma."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    registro = TratamientoBitacora(
        usuario_id=uuid,
        tipo=item_in.tipo,
        descripcion=item_in.descripcion,
        dosis_o_intensidad=item_in.dosis_o_intensidad,
        horario_alerta=item_in.horario_alerta,
        cumplido=item_in.cumplido,
        fecha_registro=item_in.fecha_registro or datetime.now(timezone.utc),
    )
    session.add(registro)
    session.commit()
    session.refresh(registro)
    return registro


@app.patch("/api/v1/bitacora/{uuid}/{item_id}", response_model=TratamientoBitacora, tags=["Bitácora"])
def actualizar_registro_bitacora(uuid: str, item_id: int, item_in: BitacoraUpdate, session: Session = Depends(get_session)):
    """
    Actualiza campos de un registro de bitácora. Si no se especifica 'cumplido',
    alterna automáticamente su valor (toggle).
    """
    registro = session.exec(
        select(TratamientoBitacora)
        .where(TratamientoBitacora.id == item_id, TratamientoBitacora.usuario_id == uuid)
    ).first()

    if not registro:
        raise HTTPException(status_code=404, detail="Registro de bitácora no encontrado")

    if item_in.cumplido is not None:
        registro.cumplido = item_in.cumplido
    elif item_in.descripcion is None and item_in.dosis_o_intensidad is None and item_in.horario_alerta is None:
        # Toggle si la petición fue vacía
        registro.cumplido = not registro.cumplido

    if item_in.descripcion is not None:
        registro.descripcion = item_in.descripcion
    if item_in.dosis_o_intensidad is not None:
        registro.dosis_o_intensidad = item_in.dosis_o_intensidad
    if item_in.horario_alerta is not None:
        registro.horario_alerta = item_in.horario_alerta

    session.add(registro)
    session.commit()
    session.refresh(registro)
    return registro


# --- Resumen Clínico con IA ---

@app.get("/api/v1/resumen/{uuid}", response_model=ResumenClinicoResponse, tags=["Resumen Clínico"])
def obtener_resumen_clinico(uuid: str, session: Session = Depends(get_session)):
    """Ejecuta el análisis clínico con IA sobre el perfil, bitácora y triajes recientes."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    bitacora = session.exec(
        select(TratamientoBitacora)
        .where(TratamientoBitacora.usuario_id == uuid)
        .order_by(TratamientoBitacora.fecha_registro.desc())
    ).all()

    triajes = session.exec(
        select(Triaje)
        .where(Triaje.usuario_id == uuid)
        .order_by(Triaje.fecha.desc())
        .limit(10)
    ).all()

    resumen = ai_service.generar_resumen_clinico(
        perfil=usuario,
        bitacora=bitacora,
        triajes=triajes,
    )
    if "adherencia_porcentaje" not in resumen and "porcentaje_adherencia" in resumen:
        resumen["adherencia_porcentaje"] = resumen["porcentaje_adherencia"]
    if "puntos_clave_consulta" not in resumen and "hallazgos_clave" in resumen:
        resumen["puntos_clave_consulta"] = resumen["hallazgos_clave"]
    return resumen


# --- Historial de Estudios, Citas y Vacunas ---

@app.get("/api/v1/estudios/{uuid}", response_model=List[HistorialEstudios], tags=["Estudios"])
def listar_estudios(uuid: str, session: Session = Depends(get_session)):
    """Lista todos los estudios, citas médicas y vacunas del usuario."""
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    estudios = session.exec(
        select(HistorialEstudios)
        .where(HistorialEstudios.usuario_id == uuid)
        .order_by(HistorialEstudios.fecha_programada.desc())
    ).all()
    return estudios


@app.post("/api/v1/estudios/{uuid}", response_model=HistorialEstudios, status_code=status.HTTP_201_CREATED, tags=["Estudios"])
def crear_estudio(
    uuid: str,
    tipo: str = Form(...),
    titulo: str = Form(...),
    fecha_programada: str = Form(...),
    nota: Optional[str] = Form(None),
    archivo: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
):
    """
    Registra un estudio, cita o vacuna mediante multipart/form-data.
    Guarda el archivo adjunto en /static/uploads con nombre único seguro si fue proporcionado.
    """
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    archivo_url_o_nota = nota

    if archivo and archivo.filename:
        nombre_limpio = limpiar_nombre_archivo(archivo.filename)
        nombre_unico = f"{py_uuid.uuid4().hex[:10]}_{nombre_limpio}"
        ruta_archivo = UPLOAD_DIR / nombre_unico

        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

        url_relativa = f"/static/uploads/{nombre_unico}"
        if nota:
            archivo_url_o_nota = f"{url_relativa} | Nota: {nota}"
        else:
            archivo_url_o_nota = url_relativa

    estudio = HistorialEstudios(
        usuario_id=uuid,
        tipo=tipo,
        titulo=titulo,
        fecha_programada=fecha_programada,
        archivo_url_o_nota=archivo_url_o_nota,
    )
    session.add(estudio)
    session.commit()
    session.refresh(estudio)
    return estudio


# --- Sincronización Offline-First ---

@app.post("/api/v1/sync/{uuid}", response_model=List[TratamientoBitacora], tags=["Sync"])
def sincronizar_bitacora(uuid: str, sync_data: SyncRequest, session: Session = Depends(get_session)):
    """
    Recibe un lote de operaciones offline de bitácora (nuevos registros o modificaciones),
    los persiste en SQLite y retorna el estado completo actualizado.
    """
    usuario = session.get(Usuario, uuid)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    for item in sync_data.items:
        if item.id is not None:
            # Intentar actualizar registro existente
            registro = session.exec(
                select(TratamientoBitacora)
                .where(TratamientoBitacora.id == item.id, TratamientoBitacora.usuario_id == uuid)
            ).first()

            if registro:
                registro.tipo = item.tipo
                registro.descripcion = item.descripcion
                registro.dosis_o_intensidad = item.dosis_o_intensidad
                registro.horario_alerta = item.horario_alerta
                registro.cumplido = item.cumplido
                if item.fecha_registro:
                    registro.fecha_registro = item.fecha_registro
                session.add(registro)
                continue

        # Si no tiene ID o no existe en la BD, crearlo
        nuevo_registro = TratamientoBitacora(
            usuario_id=uuid,
            tipo=item.tipo,
            descripcion=item.descripcion,
            dosis_o_intensidad=item.dosis_o_intensidad,
            horario_alerta=item.horario_alerta,
            cumplido=item.cumplido,
            fecha_registro=item.fecha_registro or datetime.now(timezone.utc),
        )
        session.add(nuevo_registro)

    session.commit()

    # Retornar bitácora actualizada completa
    bitacora_actualizada = session.exec(
        select(TratamientoBitacora)
        .where(TratamientoBitacora.usuario_id == uuid)
        .order_by(TratamientoBitacora.fecha_registro.desc())
    ).all()

    return bitacora_actualizada
