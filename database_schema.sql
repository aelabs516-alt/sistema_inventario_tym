-- Script de Inicialización de Base de Datos para PostgreSQL (PgAdmin)
-- Este script crea exactamente las 12 tablas con la estructura de Llave Primaria en Texto y bloque JSON.

-- Tabla: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Tabla: Product
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- Tabla: Warehouse
CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- Tabla: Pve
CREATE TABLE IF NOT EXISTS "Pve" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Pve_pkey" PRIMARY KEY ("id")
);

-- Tabla: Carrier
CREATE TABLE IF NOT EXISTS "Carrier" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- Tabla: Seller
CREATE TABLE IF NOT EXISTS "Seller" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- Tabla: Ingreso
CREATE TABLE IF NOT EXISTS "Ingreso" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- Tabla: Salida
CREATE TABLE IF NOT EXISTS "Salida" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Salida_pkey" PRIMARY KEY ("id")
);

-- Tabla: Traslado
CREATE TABLE IF NOT EXISTS "Traslado" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Traslado_pkey" PRIMARY KEY ("id")
);

-- Tabla: Reserva
CREATE TABLE IF NOT EXISTS "Reserva" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- Tabla: Factura
CREATE TABLE IF NOT EXISTS "Factura" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- Tabla: Garantia
CREATE TABLE IF NOT EXISTS "Garantia" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Garantia_pkey" PRIMARY KEY ("id")
);

-- Nota: Si requieres borrar todas las tablas y empezar de cero en PgAdmin,
-- puedes descomentar las siguientes líneas y ejecutarlas antes de crear las tablas:
/*
DROP TABLE IF EXISTS "User";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "Warehouse";
DROP TABLE IF EXISTS "Pve";
DROP TABLE IF EXISTS "Carrier";
DROP TABLE IF EXISTS "Seller";
DROP TABLE IF EXISTS "Ingreso";
DROP TABLE IF EXISTS "Salida";
DROP TABLE IF EXISTS "Traslado";
DROP TABLE IF EXISTS "Reserva";
DROP TABLE IF EXISTS "Factura";
DROP TABLE IF EXISTS "Garantia";
*/
