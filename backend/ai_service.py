import os
import json
import unicodedata
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from fastapi import HTTPException
from pydantic import BaseModel, Field

# Carga de variables de entorno
load_dotenv()

# Configuración del modelo Gemini
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

# Intentar importar google-genai
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


# ==========================================
# ESQUEMAS PYDANTIC PARA STRUCTURED OUTPUTS
# ==========================================

class TriajeIAOutput(BaseModel):
    nivel_semaforo: str = Field(description="Clasificación del triaje: 'Rojo', 'Amarillo' o 'Verde'")
    posible_interaccion: str = Field(description="Análisis de posibles interacciones con medicamentos activos o condiciones preexistentes")
    pasos_inmediatos: List[str] = Field(description="Lista de acciones o primeros pasos inmediatos a seguir")
    senales_alarma: List[str] = Field(description="Lista de signos clínicos de alarma que requieren atención urgente")
    aviso_legal: str = Field(description="Descargo de responsabilidad explícito indicando que no sustituye atención médica y no receta fármacos")


class PrimerosAuxiliosIAOutput(BaseModel):
    hacer: List[str] = Field(description="Lista de acciones recomendadas y seguras a realizar")
    evitar: List[str] = Field(description="Lista de acciones contraindicadas o peligrosas que deben evitarse estrictamente")
    alerta_critica: str = Field(description="Advertencia de máxima prioridad ante complicaciones graves")


class ResumenClinicoIAOutput(BaseModel):
    resumen_ejecutivo: str = Field(description="Síntesis médica del estado del paciente y evolución reciente")
    porcentaje_adherencia: float = Field(description="Porcentaje estimado de adherencia a tratamientos prescritos (0.0 a 100.0)")
    hallazgos_clave: List[str] = Field(description="Observaciones clínicas relevantes, patrones o factores de riesgo detectados")


# ==========================================
# REGLAS DURAS DETERMINÍSTICAS PREVIAS
# ==========================================

BANDERAS_ROJAS = [
    "dolor de pecho",
    "dificultad para respirar",
    "no respira",
    "sangrado abundante",
    "desmayo",
]


def normalizar_texto(texto: str) -> str:
    """Convierte texto a minúsculas y remueve acentos/diacríticos para comparación robusta."""
    if not texto:
        return ""
    texto = texto.lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def detectar_bandera_roja(sintomas: str) -> bool:
    """Determina si los síntomas contienen alguna bandera roja determinística."""
    sintomas_norm = normalizar_texto(sintomas)
    for bandera in BANDERAS_ROJAS:
        if bandera in sintomas_norm:
            return True
    return False


def obtener_respuesta_roja_deterministica(sintomas: str) -> Dict[str, Any]:
    """Genera una respuesta inmediata de triaje Rojo determinístico sin depender de servicios externos."""
    return {
        "nivel_semaforo": "Rojo",
        "posible_interaccion": "Alerta crítica prioritaria: Síntomas compatibles con una emergencia médica aguda potencialmente mortal.",
        "pasos_inmediatos": [
            "Llamar de inmediato al número local de emergencias (911 o servicio de ambulancias).",
            "Mantener a la persona en reposo absoluto, sentada o semisentada si tiene dificultad respiratoria.",
            "Aflojar cualquier prenda ajustada en cuello y cintura; asegurar ventilación del área.",
            "No administrar alimentos, líquidos ni medicamentos no prescritos por el médico de emergencias.",
            "Si la persona pierde el conocimiento o deja de respirar, verificar pulso e iniciar RCP de inmediato si está capacitado."
        ],
        "senales_alarma": [
            "Pérdida súbita del conocimiento o falta de respuesta a estímulos",
            "Coloración azulada en labios o uñas (cianosis)",
            "Dolor opresivo retroesternal que se irradia a mandíbula, espalda o brazo izquierdo",
            "Hemorragia profusa que no cede con presión directa continua"
        ],
        "aviso_legal": "AVISO DE EMERGENCIA MÉDICA: Kuxtal Health no sustituye la atención médica profesional de urgencias ni prescribe fármacos. Esta evaluación determinística indica un riesgo vital inminente. Acuda o traslade al paciente de inmediato al centro de salud más cercano."
    }


# ==========================================
# CLIENTE GOOGLE GENAI
# ==========================================

def get_genai_client():
    """Inicializa y retorna el cliente de google-genai validando la API key."""
    if not GENAI_AVAILABLE:
        raise RuntimeError("El paquete 'google-genai' no está instalado en el entorno.")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "tu_gemini_api_key_aqui":
        raise ValueError("GEMINI_API_KEY no se encuentra configurada en las variables de entorno.")

    return genai.Client(api_key=api_key)


# ==========================================
# FUNCIONES DE FORMATEO DE CONTEXTO
# ==========================================

def formatear_perfil(perfil: Any) -> str:
    if not perfil:
        return "Perfil no disponible"
    return (
        f"Nombre: {getattr(perfil, 'nombre', 'N/D')}\n"
        f"Edad: {getattr(perfil, 'edad', 'N/D')}\n"
        f"Tipo de Sangre: {getattr(perfil, 'tipo_sangre', 'N/D')}\n"
        f"Alergias: {getattr(perfil, 'alergias', 'Ninguna')}\n"
        f"Condiciones Crónicas: {getattr(perfil, 'condiciones_cronicas', 'Ninguna')}\n"
        f"Medicamentos Activos: {getattr(perfil, 'medicamentos_activos', 'Ninguno')}\n"
        f"Contacto de Emergencia: {getattr(perfil, 'contacto_emergencia_nombre', 'N/D')} ({getattr(perfil, 'contacto_emergencia_tel', 'N/D')})"
    )


def formatear_bitacora(bitacora: List[Any]) -> str:
    if not bitacora:
        return "Sin registros recientes en bitácora."
    lineas = []
    for item in bitacora:
        tipo = getattr(item, 'tipo', 'registro')
        desc = getattr(item, 'descripcion', '')
        dosis = getattr(item, 'dosis_o_intensidad', '')
        cumplido = "Cumplido" if getattr(item, 'cumplido', False) else "No cumplido"
        fecha = getattr(item, 'fecha_registro', '')
        lineas.append(f"- [{tipo.upper()}] {desc} | {dosis} | Estado: {cumplido} | Fecha: {fecha}")
    return "\n".join(lineas)


def formatear_triajes(triajes: List[Any]) -> str:
    if not triajes:
        return "Sin triajes previos."
    lineas = []
    for t in triajes:
        nivel = getattr(t, 'nivel_semaforo', 'N/D')
        sintomas = getattr(t, 'sintomas_actuales', '')
        fecha = getattr(t, 'fecha', '')
        lineas.append(f"- [{fecha}] Nivel: {nivel} | Síntomas: {sintomas}")
    return "\n".join(lineas)


# ==========================================
# SERVICIOS CLÍNICOS E IA
# ==========================================

def evaluar_triaje(sintomas: str, perfil: Any, bitacora: List[Any]) -> Dict[str, Any]:
    """
    Evalúa síntomas clínicos aplicando reglas determinísticas duras primero.
    Si se detectan banderas rojas, fuerza semáforo Rojo; si Gemini falla, devuelve
    la respuesta roja de contingencia sin lanzar error 500.
    Si no hay banderas rojas, consulta a Gemini 2.5 Flash con Structured Outputs.
    """
    es_rojo = detectar_bandera_roja(sintomas)

    prompt = f"""
Eres un asistente de triaje clínico inteligente para la plataforma de salud preventiva Kuxtal Health.
Evalúa los síntomas reportados por el paciente considerando su perfil clínico y los registros recientes de su bitácora de tratamientos.

DIRECTRICES OBLIGATORIAS:
1. Clasifica el semáforo estrictamente en:
   - 'Rojo': Síntomas de alarma, dolor torácico, dificultad respiratoria, hemorragias profusas, alteración del estado de conciencia o emergencias vitales.
   - 'Amarillo': Síntomas moderados que requieren atención médica pronta o valoración presencial (no inmediata pero sí oportuna).
   - 'Verde': Síntomas leves, autocuidado, orientación preventiva o seguimiento de rutinas.
{"2. ATENCIÓN: El paciente presenta síntomas con bandera roja. El 'nivel_semaforo' DEBE ser estrictamente 'Rojo'." if es_rojo else ""}
3. PROHIBICIÓN ESTRICTA: Está absolutamente PROHIBIDO recetar, dosificar o prescribir fármacos o medicamentos.
4. Analiza posibles interacciones o riesgos con sus medicamentos activos y condiciones crónicas.
5. Proporciona pasos inmediatos prácticos, seguros y señales de alarma inequívocas.
6. Incluye siempre un aviso legal explícito indicando que esta orientación no sustituye el criterio médico profesional.

--- PERFIL CLÍNICO DEL PACIENTE ---
{formatear_perfil(perfil)}

--- REGISTROS RECIENTES DE BITÁCORA ---
{formatear_bitacora(bitacora)}

--- SÍNTOMAS REPORTADOS ---
{sintomas}
"""

    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TriajeIAOutput,
                temperature=0.2,
            ),
        )

        resultado = None
        if hasattr(response, "text") and response.text:
            resultado = json.loads(response.text)
        elif hasattr(response, "parsed") and response.parsed:
            resultado = response.parsed.model_dump()

        if not resultado:
            raise ValueError("Respuesta vacía recibida del modelo Gemini.")

        # Garantizar coherencia si se detectó bandera roja
        if es_rojo:
            resultado["nivel_semaforo"] = "Rojo"

        return resultado

    except Exception as e:
        # Si se detectó bandera roja y Gemini falló (cuota, red, api key ausente),
        # devolvemos la respuesta determinística de contingencia sin error 500
        if es_rojo:
            return obtener_respuesta_roja_deterministica(sintomas)

        # En caso contrario, emitir 503 controlado
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Servicio de IA no disponible temporalmente",
                "detalle": str(e)
            }
        )


def primeros_auxilios_contextuales(evento: str, perfil: Any, bitacora: List[Any]) -> Dict[str, Any]:
    """
    Genera una guía de primeros auxilios contextualizada según el perfil del paciente
    y su medicación usando Gemini 2.5 Flash con Structured Outputs.
    """
    prompt = f"""
Eres un especialista en primeros auxilios y respuesta ante emergencias para Kuxtal Health.
Proporciona instrucciones de primeros auxilios inmediatas y seguras para el siguiente evento o accidente,
tomando en cuenta el perfil del paciente y sus condiciones preexistentes.

DIRECTRICES:
1. Divide claramente las acciones en 'hacer' (pasos seguros) y 'evitar' (errores comunes y peligrosos).
2. 'alerta_critica': Describe la señal de máxima alarma ante la cual se debe llamar de inmediato a emergencias.
3. ESTRICTAMENTE PROHIBIDO prescribir o recomendar fármacos.

--- PERFIL DEL PACIENTE ---
{formatear_perfil(perfil)}

--- MEDICAMENTOS Y BITÁCORA ---
{formatear_bitacora(bitacora)}

--- EVENTO O SITUACIÓN DE URGENCIA ---
{evento}
"""

    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PrimerosAuxiliosIAOutput,
                temperature=0.2,
            ),
        )

        if hasattr(response, "text") and response.text:
            return json.loads(response.text)
        elif hasattr(response, "parsed") and response.parsed:
            return response.parsed.model_dump()
        else:
            raise ValueError("Respuesta vacía del servicio de primeros auxilios.")

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Servicio de IA no disponible temporalmente",
                "detalle": str(e)
            }
        )


def generar_resumen_clinico(perfil: Any, bitacora: List[Any], triajes: List[Any]) -> Dict[str, Any]:
    """
    Genera un resumen clínico ejecutivo, porcentaje de adherencia y hallazgos clave
    a partir del historial y bitácora del usuario usando Gemini 2.5 Flash.
    """
    prompt = f"""
Eres un médico analista de Kuxtal Health. Evalúa los datos del paciente para generar un informe
de seguimiento preventivo y adherencia al tratamiento.

DIRECTRICES:
1. 'resumen_ejecutivo': Síntesis del estado general, evolución y estabilidad del paciente.
2. 'porcentaje_adherencia': Calcula un valor numérico flotante entre 0.0 y 100.0 basado en los medicamentos cumplidos vs programados en la bitácora.
3. 'hallazgos_clave': Lista de patrones importantes (ej. cefaleas recurrentes, tomas omitidas, controles pendientes).

--- PERFIL DEL PACIENTE ---
{formatear_perfil(perfil)}

--- HISTORIAL DE TRATAMIENTOS Y SÍNTOMAS ---
{formatear_bitacora(bitacora)}

--- TRIAJES RECIENTES ---
{formatear_triajes(triajes)}
"""

    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ResumenClinicoIAOutput,
                temperature=0.2,
            ),
        )

        if hasattr(response, "text") and response.text:
            return json.loads(response.text)
        elif hasattr(response, "parsed") and response.parsed:
            return response.parsed.model_dump()
        else:
            raise ValueError("Respuesta vacía del servicio de resumen clínico.")

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Servicio de IA no disponible temporalmente",
                "detalle": str(e)
            }
        )
