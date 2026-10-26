/**
 * SCRUM-105 — Contratos y Modelo de Datos alineados con la Arquitectura C4 y Backend FastAPI/PostgreSQL.
 * Cubre entidades de Autenticación (RF01, RNF02), Pacientes y Anamnesis (RF02, RNF06),
 * Inventario (RF03, RF09), Cronograma (RF04, RF10), Multimedia (RF05), Donaciones (RF06),
 * Contenido Institucional (RF07, RF08), Usuarios/Roles (RF11) y Auditoría (RF17).
 */

export type UserRole =
  | 'Administrador'
  | 'Coordinador'
  | 'Profesional'
  | 'Recepción'
  | 'Voluntario'

export type AccessStatus = 'Activo' | 'Pendiente' | 'Revocado'

export type ParkinsonStage =
  | 'Estadio I (Leve unilateral)'
  | 'Estadio II (Bilateral sin alteración del equilibrio)'
  | 'Estadio III (Moderado con inestabilidad postural)'
  | 'Estadio IV (Incapacidad grave pero camina con ayuda)'
  | 'Estadio V (Dependencia completa)'
  | 'Otro trastorno del movimiento'

export type InventoryOrigin = 'Propio ASPAR' | 'Préstamo Alcaldía' | 'Donación'
export type InventoryCondition = 'Óptimo' | 'Bueno' | 'En mantenimiento' | 'Baja'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type AuditCategory =
  | 'AUTENTICACION'
  | 'PACIENTES'
  | 'CONSENTIMIENTO'
  | 'USUARIOS_ROLES'
  | 'INVENTARIO'
  | 'CRONOGRAMA'
  | 'DONACIONES'
  | 'SISTEMA'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  department?: string
  createdAt?: string
}

export interface ClinicalAnamnesis {
  diagnosis: string
  stage: ParkinsonStage
  neurologistCertificate: boolean
  symptomNotes: string
  physicalEvaluation: string
  speechEvaluation: string
  psychologicalEvaluation: string
  medications: string
}

export interface Patient {
  id: string
  name: string
  ci: string
  phone: string
  address: string
  emergencyContact: string
  caregiverRelation: string
  consent: boolean
  consentDate?: string
  accessStatus: AccessStatus
  anamnesis: ClinicalAnamnesis
  createdAt?: string
  updatedAt?: string
}

export interface Session {
  userId: string
  name: string
  email: string
  role: UserRole
  token: string
  expiresAt: number
  lastActivityAt: number
}

export interface LoginRequestDto {
  email: string
  password: string
}

export interface LoginResponseDto {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  idle_timeout: number
  user: User
}

export interface AuditEvent {
  id: string
  date: string
  actor: string
  actorRole: UserRole | 'Sistema'
  category: AuditCategory
  severity: AuditSeverity
  action: string
  detail: string
  ipAddress?: string
}

export type AttendanceStatus = 'Pendiente' | 'Presente' | 'Ausente'

export interface AttendanceEntry {
  id: string
  patientId?: string
  patientName: string
  date: string
  time: string
  activity: string
  status: AttendanceStatus
}

export interface ScheduleItem {
  id: string
  date: string
  time: string
  title: string
  category: 'Fisioterapia' | 'Arteterapia' | 'Fonoaudiología' | 'Psicología' | 'Bienestar'
  professional: string
  location: string
  spots: number
}

export interface InventoryItem {
  id: string
  code: string
  name: string
  category: 'Fisioterapia' | 'Mobiliario' | 'Papelería' | 'Ayuda Técnica'
  quantity: number
  origin: InventoryOrigin
  condition: InventoryCondition
  location: string
  updatedAt: string
}

export interface MediaAsset {
  id: string
  title: string
  type: 'Imagen' | 'Video'
  category: string
  storageProvider: 'Cloudinary / AWS S3'
  url: string
  sizeMb: number
  uploadedAt: string
}

export interface DonationRecord {
  id: string
  donorName: string
  amountBs: number
  method: 'QR Bancario' | 'Pasarela Libélula' | 'Transferencia Directa'
  purpose: string
  status: 'Verificado' | 'Pendiente'
  date: string
}

export interface InstitutionalInfo {
  mission: string
  vision: string
  historySummary: string
  inspirationModel: string
  enrollmentRequirements: string[]
  socialLinks: {
    facebook: string
    instagram: string
    tiktok: string
  }
}
