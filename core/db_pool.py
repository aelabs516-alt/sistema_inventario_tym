"""
Configuración modular de Connection Pooling para PostgreSQL (6 vCPUs / 12 GB RAM).
Soporta configuración nativa de Django (CONN_MAX_AGE + CONN_HEALTH_CHECKS / pre-ping)
y parámetros de pool (pool_size=15-20, max_overflow=10, pool_recycle=1800, pool_pre_ping=True).
"""

import os
from typing import Dict, Any

POOL_CONFIG = {
    "pool_size": int(os.getenv("DB_POOL_SIZE", "18")),          # Rango recomendado: 15 a 20
    "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),    # Conexiones adicionales en pico
    "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),  # 1800 segundos (30 min)
    "pool_pre_ping": os.getenv("DB_POOL_PRE_PING", "true").lower() in ("true", "1", "yes"),
    "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
}


def configure_django_database_pool(db_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enriquece el diccionario DATABASES['default'] de Django con persistencia de conexiones
    (pool_recycle = 1800s), health checks (pool_pre_ping = True) y opciones TCP Keepalive
    para PostgreSQL sin romper compatibilidad con SQLite en entornos de desarrollo local.
    """
    if not db_config:
        return db_config

    engine = db_config.get("ENGINE", "")
    is_postgres = "postgresql" in engine or "psycopg" in engine or "postgis" in engine

    # Equivalente en Django ORM a pool_recycle=1800 y pool_pre_ping=True
    db_config["CONN_MAX_AGE"] = POOL_CONFIG["pool_recycle"]
    db_config["CONN_HEALTH_CHECKS"] = POOL_CONFIG["pool_pre_ping"]

    if is_postgres:
        options = dict(db_config.get("OPTIONS", {}))
        options.setdefault("connect_timeout", 10)
        # TCP Keepalives para detectar conexiones caídas a nivel de red en VPS
        options.setdefault("keepalives", 1)
        options.setdefault("keepalives_idle", 60)
        options.setdefault("keepalives_interval", 10)
        options.setdefault("keepalives_count", 5)
        db_config["OPTIONS"] = options

    return db_config


def get_sqlalchemy_engine_kwargs() -> Dict[str, Any]:
    """
    Retorna los argumentos exactos para SQLAlchemy create_engine() en caso de uso
    híbrido o servicios analíticos auxiliares sobre la misma base PostgreSQL.
    """
    return {
        "pool_size": POOL_CONFIG["pool_size"],
        "max_overflow": POOL_CONFIG["max_overflow"],
        "pool_recycle": POOL_CONFIG["pool_recycle"],
        "pool_pre_ping": POOL_CONFIG["pool_pre_ping"],
        "pool_timeout": POOL_CONFIG["pool_timeout"],
    }
