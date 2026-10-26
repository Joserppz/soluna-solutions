-- SCRUM-64 / SCRUM-105: Esquema relacional ASPAR (PostgreSQL / SQLite compatible)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('Administrador', 'Coordinador', 'Profesional', 'Recepción', 'Voluntario')),
    department VARCHAR(80) DEFAULT 'General',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    ci VARCHAR(32) UNIQUE NOT NULL,
    phone VARCHAR(32) NOT NULL,
    address VARCHAR(200) NOT NULL,
    emergency_contact VARCHAR(120) NOT NULL,
    caregiver_relation VARCHAR(80) NOT NULL,
    consent BOOLEAN NOT NULL DEFAULT FALSE,
    consent_date VARCHAR(40),
    access_status VARCHAR(24) NOT NULL CHECK (access_status IN ('Activo', 'Pendiente', 'Revocado')),
    diagnosis VARCHAR(160) NOT NULL,
    stage VARCHAR(80) NOT NULL,
    neurologist_certificate BOOLEAN NOT NULL DEFAULT FALSE,
    symptom_notes TEXT,
    physical_evaluation TEXT,
    speech_evaluation TEXT,
    psychological_evaluation TEXT,
    medications TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    date VARCHAR(40) NOT NULL,
    actor VARCHAR(150) NOT NULL,
    actor_role VARCHAR(40) NOT NULL,
    category VARCHAR(40) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    action VARCHAR(120) NOT NULL,
    detail TEXT NOT NULL,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1'
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    origin VARCHAR(40) NOT NULL CHECK (origin IN ('Propio ASPAR', 'Préstamo Alcaldía', 'Donación')),
    condition VARCHAR(40) NOT NULL CHECK (condition IN ('Óptimo', 'Bueno', 'En mantenimiento', 'Baja')),
    location VARCHAR(120) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
);
