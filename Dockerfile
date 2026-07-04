# Usamos una imagen oficial y ligera de Python 3.12
FROM python:3.12-slim

# Evitamos que Python escriba archivos de caché y forzamos la salida en consola
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Establecemos el directorio de trabajo
WORKDIR /app

# Instalamos dependencias del sistema necesarias para PostgreSQL
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copiamos e instalamos los requerimientos
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos todo el código del proyecto
COPY . .

# Recolectamos los estáticos en la fase de construcción (SIN tocar la base de datos real)
RUN python manage.py collectstatic --noinput

# Exponemos el puerto de la aplicación
EXPOSE 8000

# Comando de inicio: Migra la BD real y enciende el servidor
CMD ["sh", "-c", "python manage.py migrate && gunicorn core.wsgi:application --bind 0.0.0.0:8000"]