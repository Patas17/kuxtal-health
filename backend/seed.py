from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Session, select
from database import engine, init_db
from models import Usuario, TratamientoBitacora, HistorialEstudios

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


def seed_db(session: Optional[Session] = None) -> None:
    """Inserta datos iniciales de prueba si la base de datos no contiene usuarios."""
    close_session = False
    if session is None:
        session = Session(engine)
        close_session = True

    try:
        # Verificar si ya existen usuarios registrados
        usuario_existente = session.exec(select(Usuario)).first()
        if usuario_existente:
            print("Base de datos ya contiene información. Omitiendo datos semilla.")
            return

        # 1. Crear Paciente Demo determinístico
        demo_user = Usuario(
            id=DEMO_USER_ID,
            nombre="Carlos Mendoza",
            edad=54,
            tipo_sangre="O+",
            alergias="Penicilina",
            condiciones_cronicas="Hipertensión",
            medicamentos_activos="Losartán 50mg",
            contacto_emergencia_nombre="María Mendoza",
            contacto_emergencia_tel="9981234567",
        )
        session.add(demo_user)

        # 2. Agregar 3 registros en bitácora (2 medicamentos y 1 síntoma)
        ahora = datetime.now(timezone.utc)
        bitacoras = [
            TratamientoBitacora(
                usuario_id=DEMO_USER_ID,
                tipo="medicamento",
                descripcion="Losartán",
                dosis_o_intensidad="50mg",
                horario_alerta="08:00",
                cumplido=True,
                fecha_registro=ahora,
            ),
            TratamientoBitacora(
                usuario_id=DEMO_USER_ID,
                tipo="medicamento",
                descripcion="Losartán",
                dosis_o_intensidad="50mg",
                horario_alerta="20:00",
                cumplido=False,
                fecha_registro=ahora,
            ),
            TratamientoBitacora(
                usuario_id=DEMO_USER_ID,
                tipo="sintoma",
                descripcion="Cefalea leve matutina",
                dosis_o_intensidad="Intensidad 3/10",
                horario_alerta=None,
                cumplido=False,
                fecha_registro=ahora,
            ),
        ]
        for b in bitacoras:
            session.add(b)

        # 3. Agregar 1 registro en historial_estudios
        estudio = HistorialEstudios(
            usuario_id=DEMO_USER_ID,
            tipo="estudio",
            titulo="Química Sanguínea de 6 Elementos",
            fecha_programada="2026-12-01",
            archivo_url_o_nota="Control de glucosa y perfil lipídico semestral.",
        )
        session.add(estudio)

        session.commit()
        print("Datos semilla insertados exitosamente.")
    finally:
        if close_session:
            session.close()


if __name__ == "__main__":
    init_db()
    seed_db()
