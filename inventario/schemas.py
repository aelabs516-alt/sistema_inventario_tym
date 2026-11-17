"""
Esquemas de validación estricta (Pydantic) y sanitización de payloads de entrada
contra inyecciones SQL/NoSQL, Null-Byte Injection e Inyección de Comandos.
"""

import re
from typing import Any, Dict, List, Union

try:
    from pydantic import BaseModel, Field, field_validator
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    BaseModel = object  # type: ignore

# Operadores de inyección NoSQL prohibidos en llaves de objetos JSON
NOSQL_FORBIDDEN_KEYS = {
    "$where", "$gt", "$gte", "$lt", "$lte", "$ne", "$in", "$nin",
    "$or", "$and", "$not", "$nor", "$regex", "$expr", "$function",
}

# Patrones de inyección SQL / comandos peligrosos en identificadores o campos cortos
DANGEROUS_SQL_PATTERN = re.compile(
    r"(;\s*(DROP|ALTER|TRUNCATE|EXEC|EXECUTE)\s+|UNION\s+ALL\s+SELECT|UNION\s+SELECT|--\s*$)",
    re.IGNORECASE,
)


def sanitize_scalar(value: Any, is_key: bool = False) -> Any:
    """
    Limpia caracteres nulos (\x00) y valida que las cadenas cortas e identificadores
    no contengan payloads de inyección SQL/NoSQL. No altera imágenes Base64 legítimas.
    """
    if isinstance(value, str):
        cleaned = value.replace("\x00", "")
        if is_key and (cleaned in NOSQL_FORBIDDEN_KEYS or cleaned.startswith("$")):
            raise ValueError(f"Clave de payload no permitida por política de seguridad: {cleaned}")
        # Omitir inspección regex pesada en cadenas Base64 de imágenes/soportes
        if len(cleaned) < 2048 and not cleaned.startswith("data:image/"):
            if DANGEROUS_SQL_PATTERN.search(cleaned):
                raise ValueError("Secuencia potencialmente maliciosa detectada en el payload.")
        return cleaned
    return value


def validate_and_sanitize_payload(payload: Any, max_depth: int = 12, _depth: int = 0) -> Any:
    """
    Valida tipos recursivamente y sanitiza diccionarios, listas y escalares.
    """
    if _depth > max_depth:
        raise ValueError("El payload excede la profundidad máxima permitida.")

    if isinstance(payload, dict):
        sanitized_dict: Dict[str, Any] = {}
        for k, v in payload.items():
            if not isinstance(k, str):
                raise ValueError("Todas las claves de objetos JSON deben ser cadenas de texto (str).")
            clean_key = sanitize_scalar(k, is_key=True)
            sanitized_dict[clean_key] = validate_and_sanitize_payload(v, max_depth, _depth + 1)
        return sanitized_dict

    if isinstance(payload, list):
        return [validate_and_sanitize_payload(item, max_depth, _depth + 1) for item in payload]

    if isinstance(payload, (str, int, float, bool)) or payload is None:
        return sanitize_scalar(payload)

    raise ValueError(f"Tipo de dato no permitido en payload JSON: {type(payload).__name__}")


if HAS_PYDANTIC:
    class LoginSchema(BaseModel):
        email: str = Field(..., min_length=1, max_length=255)
        password: str = Field(..., min_length=1, max_length=255)

        @field_validator("email")
        @classmethod
        def sanitize_email(cls, v: str) -> str:
            v = sanitize_scalar(v.strip().lower())
            if len(v) > 255:
                raise ValueError("Usuario/email excede longitud máxima.")
            return v

        @field_validator("password")
        @classmethod
        def sanitize_password(cls, v: str) -> str:
            return v.replace("\x00", "")

    class RevokeSessionsSchema(BaseModel):
        email: str = Field(default="", max_length=255)
        include_current: bool = Field(default=False)


def parse_login_payload(raw_data: Dict[str, Any]) -> Dict[str, str]:
    if not isinstance(raw_data, dict):
        raise ValueError("El cuerpo de autenticación debe ser un objeto JSON.")
    if HAS_PYDANTIC:
        validated = LoginSchema(**raw_data)
        return {"email": validated.email, "password": validated.password}
    email = sanitize_scalar(str(raw_data.get("email", "")).strip().lower())
    password = str(raw_data.get("password", "")).replace("\x00", "")
    if not email or not password:
        raise ValueError("Faltan credenciales.")
    return {"email": email, "password": password}
