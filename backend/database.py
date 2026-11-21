import os
from collections.abc import Generator
from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine

# Cargar variables de entorno desde .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kuxtal.db")

# Si se usa SQLite, deshabilitar verificación de mismo hilo para FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def init_db() -> None:
    """Crea todas las tablas definidas en los modelos."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Generador de sesiones para inyección de dependencias en endpoints."""
    with Session(engine) as session:
        yield session
