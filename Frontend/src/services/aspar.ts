import { ApiError, asparApiClient } from './api'
import type {
  AccessStatus,
  AttendanceEntry,
  AttendanceStatus,
  AuditCategory,
  AuditEvent,
  AuditSeverity,
  ClinicalAnamnesis,
  DonationRecord,
  InstitutionalInfo,
  InventoryCondition,
  InventoryItem,
  InventoryOrigin,
  MediaAsset,
  ParkinsonStage,
  Patient,
  ScheduleItem,
  Session,
  User,
  UserRole,
} from '../types/aspar'

export type {
  AccessStatus,
  AttendanceEntry,
  AttendanceStatus,
  AuditCategory,
  AuditEvent,
  AuditSeverity,
  ClinicalAnamnesis,
  DonationRecord,
  InstitutionalInfo,
  InventoryCondition,
  InventoryItem,
  InventoryOrigin,
  MediaAsset,
  ParkinsonStage,
  Patient,
  ScheduleItem,
  Session,
  User,
  UserRole,
}

export const SESSION_MAX_AGE = 30 * 60 * 1000
export const SESSION_IDLE_LIMIT = 15 * 60 * 1000
export const SESSION_WARNING_THRESHOLD = 2 * 60 * 1000

export const USER_ROLES: UserRole[] = [
  'Administrador',
  'Coordinador',
  'Profesional',
  'Recepción',
  'Voluntario',
]

// RNF-06: mismos grupos de roles que Backend/app/core/constants.py
export const CLINICAL_ROLES: UserRole[] = [
  'Administrador',
  'Coordinador',
  'Profesional',
]
export const PATIENT_EDITOR_ROLES: UserRole[] = [...CLINICAL_ROLES, 'Recepción']

const CLINICAL_ONLY_FIELDS = [
  'symptomNotes',
  'physicalEvaluation',
  'speechEvaluation',
  'psychologicalEvaluation',
  'medications',
] as const

export const PARKINSON_STAGES: ParkinsonStage[] = [
  'Estadio I (Leve unilateral)',
  'Estadio II (Bilateral sin alteración del equilibrio)',
  'Estadio III (Moderado con inestabilidad postural)',
  'Estadio IV (Incapacidad grave pero camina con ayuda)',
  'Estadio V (Dependencia completa)',
  'Otro trastorno del movimiento',
]

const DEMO_USERS: User[] = [
  {
    id: 'u-admin',
    name: 'Greta Torrez (Directora ASPAR)',
    email: 'admin@aspar.org',
    role: 'Administrador',
    department: 'Dirección Ejecutiva',
    active: true,
    createdAt: '2026-08-12T10:00:00Z',
  },
  {
    id: 'u-coord',
    name: 'Junior Quiroga',
    email: 'coordinacion@aspar.org',
    role: 'Coordinador',
    department: 'Coordinación General',
    active: true,
    createdAt: '2026-08-12T10:05:00Z',
  },
  {
    id: 'u-demo',
    name: 'Lic. Ana Flores',
    email: 'demo@aspar.org',
    role: 'Profesional',
    department: 'Fisioterapia y Rehabilitación',
    active: true,
    createdAt: '2026-08-12T10:10:00Z',
  },
  {
    id: 'u-recep',
    name: 'Carla Mendoza',
    email: 'recepcion@aspar.org',
    role: 'Recepción',
    department: 'Atención y Afiliaciones',
    active: true,
    createdAt: '2026-08-12T10:15:00Z',
  },
  {
    id: 'u-vol',
    name: 'Mateo Quispe',
    email: 'voluntario@aspar.org',
    role: 'Voluntario',
    department: 'Apoyo Sabatino',
    active: true,
    createdAt: '2026-08-12T10:20:00Z',
  },
]

const DEMO_PASSWORDS: Record<string, string> = {
  'admin@aspar.org': 'Admin2026!',
  'coordinacion@aspar.org': 'Coord2026!',
  'demo@aspar.org': 'Aspar2026!',
  'recepcion@aspar.org': 'Recep2026!',
  'voluntario@aspar.org': 'Voluntario2026!',
}

const DEFAULT_ANAMNESIS: ClinicalAnamnesis = {
  diagnosis: 'Enfermedad de Parkinson idiopática',
  stage: 'Estadio I (Leve unilateral)',
  neurologistCertificate: false,
  symptomNotes: '',
  physicalEvaluation: '',
  speechEvaluation: '',
  psychologicalEvaluation: '',
  medications: '',
}

const DEMO_PATIENTS: Patient[] = [
  {
    id: 'p-1',
    name: 'Elena Rojas',
    ci: '1234567',
    phone: '70000001',
    address: 'Av. Arce #2140, Sopocachi, La Paz',
    emergencyContact: 'Carlos Rojas (71522334)',
    caregiverRelation: 'Hijo / Cuidador principal',
    consent: true,
    consentDate: '2026-08-15',
    accessStatus: 'Activo',
    anamnesis: {
      diagnosis: 'Enfermedad de Parkinson idiopática',
      stage: 'Estadio II (Bilateral sin alteración del equilibrio)',
      neurologistCertificate: true,
      symptomNotes:
        'Temblor en reposo en miembro superior derecho y bradicinesia leve.',
      physicalEvaluation:
        'Marcha independiente con reducción de braceo; equilibrio conservado.',
      speechEvaluation:
        'Hipofonía leve; articulación comprensible, requiere ejercicios de proyección vocal.',
      psychologicalEvaluation:
        'Ánimo estable, alta adherencia a talleres grupales sabatinos.',
      medications: 'Levodopa/Carbidopa 250/25 mg cada 8 horas',
    },
  },
  {
    id: 'p-2',
    name: 'Miguel Fernández',
    ci: '7654321',
    phone: '70000002',
    address: 'Calle 15 de Calacoto #450, La Paz',
    emergencyContact: 'Lucía Fernández (70688912)',
    caregiverRelation: 'Esposa / Familiar directo',
    consent: false,
    consentDate: '',
    accessStatus: 'Pendiente',
    anamnesis: {
      diagnosis: 'Parkinsonismo en evaluación clínica',
      stage: 'Estadio I (Leve unilateral)',
      neurologistCertificate: false,
      symptomNotes:
        'Rigidez matutina leve validada por observación de síntomas en admisión.',
      physicalEvaluation:
        'Rango articular funcional; pendiente completar batería de equilibrio.',
      speechEvaluation: 'Sin disfagia; fluidez verbal normal.',
      psychologicalEvaluation:
        'Ansiedad leve ante diagnóstico reciente; se sugiere acompañamiento.',
      medications: 'En ajuste por neurología',
    },
  },
]

function encodeJwtToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(encodeURIComponent(JSON.stringify(payload)))
  const signature = btoa(`aspar-sig-${payload.sub}-${payload.exp}`)
  return `${header}.${body}.${signature}`
}

export function decodeJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const raw = parts[1]
    if (!raw) return null
    const jsonStr = raw.includes('%')
      ? decodeURIComponent(atob(raw))
      : atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(jsonStr) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

function readStorage<T>(key: string, initialValue: T): T {
  const stored = localStorage.getItem(key)

  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initialValue))
    return initialValue
  }

  try {
    return JSON.parse(stored) as T
  } catch {
    localStorage.setItem(key, JSON.stringify(initialValue))
    return initialValue
  }
}

function writeStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function addAudit(
  action: string,
  detail: string,
  category: AuditCategory = 'SISTEMA',
  severity: AuditSeverity = 'INFO',
): void {
  const session = getSession()
  const events = getAuditEvents()

  events.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    actor: session?.email ?? 'Sistema',
    actorRole: session?.role ?? 'Sistema',
    category,
    severity,
    action,
    detail,
    ipAddress: '127.0.0.1',
  })

  writeStorage('aspar_audit', events.slice(0, 500))
}

export function getUsers(): User[] {
  return readStorage('aspar_users', DEMO_USERS)
}

export async function syncUsersFromApi(): Promise<User[]> {
  try {
    const remoteUsers = await asparApiClient.fetchUsers()
    writeStorage('aspar_users', remoteUsers)
    return remoteUsers
  } catch {
    return getUsers()
  }
}

export function getPatients(): Patient[] {
  const rawPatients = readStorage<Patient[]>('aspar_patients', DEMO_PATIENTS)
  return rawPatients.map((patient) => ({
    ...patient,
    address: patient.address || 'La Paz, Bolivia',
    caregiverRelation: patient.caregiverRelation || 'Familiar / Cuidador',
    anamnesis: {
      ...DEFAULT_ANAMNESIS,
      ...(patient.anamnesis || {}),
    },
  }))
}

export async function syncPatientsFromApi(): Promise<Patient[]> {
  try {
    const remotePatients = await asparApiClient.fetchPatients()
    writeStorage('aspar_patients', remotePatients)
    return remotePatients
  } catch {
    return getPatients()
  }
}

export function getAuditEvents(): AuditEvent[] {
  const stored = readStorage<AuditEvent[]>('aspar_audit', [])
  return stored.map((item) => ({
    ...item,
    actorRole: item.actorRole || 'Administrador',
    category: item.category || 'SISTEMA',
    severity: item.severity || 'INFO',
    ipAddress: item.ipAddress || '127.0.0.1',
  }))
}

export async function syncAuditFromApi(filters?: {
  category?: string
  severity?: string
}): Promise<AuditEvent[]> {
  try {
    const remoteEvents = await asparApiClient.fetchAuditLogs(filters)
    writeStorage('aspar_audit', remoteEvents)
    return remoteEvents
  } catch {
    return getAuditEvents()
  }
}

export function getSession(): Session | null {
  const raw = localStorage.getItem('aspar_session')

  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    const now = Date.now()
    const tokenExp = session.token ? decodeJwtExpiry(session.token) : null
    const expired =
      now >= session.expiresAt ||
      now - session.lastActivityAt >= SESSION_IDLE_LIMIT ||
      (tokenExp !== null && now >= tokenExp)

    if (expired) {
      localStorage.removeItem('aspar_session')
      return null
    }

    return session
  } catch {
    localStorage.removeItem('aspar_session')
    return null
  }
}

export function getSessionRemainingMs(): {
  totalRemainingMs: number
  idleRemainingMs: number
  effectiveRemainingMs: number
} | null {
  const session = getSession()
  if (!session) return null
  const now = Date.now()
  const totalRemainingMs = Math.max(0, session.expiresAt - now)
  const idleRemainingMs = Math.max(
    0,
    SESSION_IDLE_LIMIT - (now - session.lastActivityAt),
  )
  return {
    totalRemainingMs,
    idleRemainingMs,
    effectiveRemainingMs: Math.min(totalRemainingMs, idleRemainingMs),
  }
}

export function signIn(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  const user = getUsers().find(
    (item) => item.email.toLowerCase() === normalizedEmail,
  )

  if (!user || !user.active || DEMO_PASSWORDS[normalizedEmail] !== password) {
    addAudit(
      'Intento fallido de inicio de sesión',
      `Credenciales inválidas o cuenta inactiva para ${normalizedEmail || 'correo vacío'}`,
      'AUTENTICACION',
      'WARNING',
    )
    return false
  }

  const now = Date.now()
  const expiresAt = now + SESSION_MAX_AGE
  const token = encodeJwtToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: expiresAt,
  })

  const session: Session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
    expiresAt,
    lastActivityAt: now,
    source: 'local',
  }

  writeStorage('aspar_session', session)
  addAudit(
    'Inicio de sesión',
    `Ingresó ${user.email} (${user.role}) con sesión JWT válida`,
    'AUTENTICACION',
    'INFO',
  )
  return true
}

/** El modo local de demostración solo se habilita en desarrollo o con VITE_DEMO_MODE=true. */
export function isLocalModeAllowed(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'
}

export async function signInWithApi(
  email: string,
  password: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await asparApiClient.login({ email, password })
    const now = Date.now()
    const session: Session = {
      userId: response.user.id,
      name: response.user.name,
      email: response.user.email,
      role: response.user.role,
      token: response.access_token,
      expiresAt: now + response.expires_in * 1000,
      lastActivityAt: now,
      source: 'api',
    }
    writeStorage('aspar_session', session)
    addAudit(
      'Inicio de sesión (API JWT)',
      `Autenticación verificada con Backend para ${response.user.email}`,
      'AUTENTICACION',
      'INFO',
    )
    return { ok: true }
  } catch (cause) {
    // Si la API respondió (401, 423, 422...), su decisión es la final: el modo
    // local no puede saltarse un rechazo o un bloqueo del servidor.
    if (cause instanceof ApiError) {
      return { ok: false, message: cause.message }
    }
    // Backend no disponible: el modo local (contraseñas de demostración) solo
    // existe en desarrollo; en producción nunca reemplaza al servidor (ADR-008).
    if (!isLocalModeAllowed()) {
      return {
        ok: false,
        message:
          'No se pudo conectar con el servidor. Intenta nuevamente en unos minutos.',
      }
    }
    // Se intenta una sola vez para no duplicar el registro en la bitácora.
    const localSuccess = signIn(email, password)
    if (!localSuccess) {
      return {
        ok: false,
        message: 'Correo o contraseña incorrectos, o usuario inactivo.',
      }
    }
    return { ok: true }
  }
}

export function touchSession(): void {
  const session = getSession()
  if (!session) return

  const now = Date.now()
  writeStorage('aspar_session', {
    ...session,
    lastActivityAt: now,
  })
}

export async function renewSession(): Promise<Session | null> {
  const session = getSession()
  if (!session) return null

  const now = Date.now()
  let token: string
  let expiresAt: number

  if (session.source === 'api') {
    // Un token del Backend solo puede renovarlo el Backend; un token local
    // sería rechazado por la API en la siguiente petición.
    try {
      const response = await asparApiClient.refresh()
      token = response.access_token
      expiresAt = now + response.expires_in * 1000
    } catch {
      addAudit(
        'Renovación de token rechazada',
        `El Backend no renovó la sesión de ${session.email}`,
        'AUTENTICACION',
        'WARNING',
      )
      return null
    }
  } else {
    expiresAt = now + SESSION_MAX_AGE
    token = encodeJwtToken({
      sub: session.userId,
      email: session.email,
      role: session.role,
      iat: now,
      exp: expiresAt,
    })
  }

  const updated: Session = {
    ...session,
    token,
    expiresAt,
    lastActivityAt: now,
  }

  writeStorage('aspar_session', updated)
  addAudit(
    'Renovación de token JWT',
    `Se renovó el token de sesión activa para ${session.email}`,
    'AUTENTICACION',
    'INFO',
  )
  return updated
}

export function signOut(reason = 'Cierre manual de sesión'): void {
  const session = getSession()

  if (session) {
    addAudit(
      'Cierre de sesión',
      `Cerró sesión ${session.email} (${reason})`,
      'AUTENTICACION',
      'INFO',
    )
    asparApiClient.logout().catch(() => undefined)
  }

  localStorage.removeItem('aspar_session')
}

export type PatientInput = {
  name: string
  ci: string
  phone: string
  address?: string
  emergencyContact: string
  caregiverRelation?: string
  consent: boolean
  consentDate?: string
  accessStatus: AccessStatus
  anamnesis?: Partial<ClinicalAnamnesis>
}

export function validatePatientInput(input: PatientInput): string | null {
  if (!input.name || input.name.trim().length < 3) {
    return 'El nombre completo debe tener al menos 3 caracteres.'
  }
  if (!/^\d{5,10}(-[0-9A-Za-z]{1,3})?$/.test(input.ci.trim())) {
    return 'La Cédula de Identidad debe contener entre 5 y 10 dígitos válidos.'
  }
  if (!/^\d{7,12}$/.test(input.phone.trim())) {
    return 'El teléfono debe contener entre 7 y 12 dígitos numéricos.'
  }
  if (!input.emergencyContact || input.emergencyContact.trim().length < 3) {
    return 'El contacto de emergencia o cuidador es obligatorio.'
  }
  if (input.accessStatus === 'Activo' && !input.consent) {
    return 'No se puede activar el acceso clínico sin consentimiento informado firmado (RNF-06).'
  }
  return null
}

export function savePatient(patient: PatientInput): Patient {
  const validationError = validatePatientInput(patient)
  if (validationError) {
    throw new Error(validationError)
  }

  const patients = getPatients()
  if (
    patients.some(
      (existing) =>
        existing.ci.trim().toLowerCase() === patient.ci.trim().toLowerCase(),
    )
  ) {
    throw new Error(
      'Ya existe un paciente registrado con esa Cédula de Identidad.',
    )
  }

  const nowIso = new Date().toISOString()
  const newPatient: Patient = {
    id: crypto.randomUUID(),
    name: patient.name.trim(),
    ci: patient.ci.trim(),
    phone: patient.phone.trim(),
    address: (patient.address ?? 'La Paz, Bolivia').trim() || 'La Paz, Bolivia',
    emergencyContact: patient.emergencyContact.trim(),
    caregiverRelation:
      (patient.caregiverRelation ?? 'Familiar / Cuidador').trim() ||
      'Familiar / Cuidador',
    consent: patient.consent,
    consentDate: patient.consent
      ? patient.consentDate || nowIso.slice(0, 10)
      : '',
    accessStatus: patient.consent ? patient.accessStatus : 'Pendiente',
    anamnesis: {
      ...DEFAULT_ANAMNESIS,
      ...withoutForbiddenClinicalFields(patient.anamnesis || {}),
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  writeStorage('aspar_patients', [...patients, newPatient])
  addAudit(
    'Registro de paciente y anamnesis',
    `Registró a ${newPatient.name} (CI: ${newPatient.ci}) con estado ${newPatient.accessStatus}`,
    'PACIENTES',
    'INFO',
  )

  asparApiClient
    .createPatient({
      name: newPatient.name,
      ci: newPatient.ci,
      phone: newPatient.phone,
      address: newPatient.address,
      emergencyContact: newPatient.emergencyContact,
      caregiverRelation: newPatient.caregiverRelation,
      consent: newPatient.consent,
      consentDate: newPatient.consentDate,
      accessStatus: newPatient.accessStatus,
      anamnesis: newPatient.anamnesis,
    })
    .catch(() => undefined)

  return newPatient
}

export function updatePatient(
  id: string,
  changes: Partial<Omit<Patient, 'id'>>,
): void {
  const patients = getPatients()
  const updatedPatients = patients.map((patient) => {
    if (patient.id !== id) return patient
    const nextConsent =
      changes.consent !== undefined ? changes.consent : patient.consent
    let nextAccess =
      changes.accessStatus !== undefined
        ? changes.accessStatus
        : patient.accessStatus

    // RNF-06: Si no hay consentimiento activo, el estado no puede quedar 'Activo'
    if (!nextConsent && nextAccess === 'Activo') {
      nextAccess = 'Pendiente'
    }

    return {
      ...patient,
      ...changes,
      consent: nextConsent,
      consentDate: nextConsent
        ? patient.consentDate || new Date().toISOString().slice(0, 10)
        : '',
      accessStatus: nextAccess,
      anamnesis: changes.anamnesis
        ? { ...patient.anamnesis, ...changes.anamnesis }
        : patient.anamnesis,
      updatedAt: new Date().toISOString(),
    }
  })

  writeStorage('aspar_patients', updatedPatients)
  const target = updatedPatients.find((p) => p.id === id)
  const isRevoked =
    target?.accessStatus === 'Revocado' || target?.consent === false
  addAudit(
    'Actualización de consentimiento / acceso de paciente',
    `Actualizó el registro ${target?.name ?? id} (consentimiento=${target?.consent}, estado=${target?.accessStatus})`,
    'CONSENTIMIENTO',
    isRevoked ? 'WARNING' : 'INFO',
  )

  asparApiClient.patchPatient(id, changes).catch(() => undefined)
}

export function canViewClinicalRecord(patient: Patient): boolean {
  return clinicalAccessNotice(patient) === null
}

/** Recepción, Profesional, Coordinador y Administrador registran y editan fichas. */
export function canEditPatients(): boolean {
  const role = getSession()?.role
  return Boolean(role && PATIENT_EDITOR_ROLES.includes(role))
}

/** Solo el personal clínico registra evaluaciones, síntomas y medicación. */
export function canRegisterClinicalNotes(): boolean {
  const role = getSession()?.role
  return Boolean(role && CLINICAL_ROLES.includes(role))
}

/**
 * RNF-06: explica por qué la anamnesis no se muestra, o devuelve null si se puede ver.
 * Primero se revisa el rol y después el consentimiento, igual que el Backend.
 */
export function clinicalAccessNotice(patient: Patient): string | null {
  const session = getSession()
  if (!session) return 'Inicia sesión para consultar datos clínicos.'
  if (!CLINICAL_ROLES.includes(session.role)) {
    return `Tu rol (${session.role}) no tiene acceso a los datos clínicos. Solo el personal clínico (Administrador, Coordinador o Profesional) puede consultarlos (RNF-06).`
  }
  if (!patient.consent) {
    return 'El paciente no tiene consentimiento informado firmado: sus datos clínicos están protegidos (RNF-06).'
  }
  if (patient.accessStatus !== 'Activo') {
    return `El acceso clínico de este paciente está «${patient.accessStatus}»: sus datos clínicos están protegidos (RNF-06).`
  }
  return null
}

// Igual que el Backend: quien no es personal clínico no envía evaluaciones ni medicación
function withoutForbiddenClinicalFields(
  anamnesis: Partial<ClinicalAnamnesis>,
): Partial<ClinicalAnamnesis> {
  if (canRegisterClinicalNotes()) return anamnesis
  const allowed = { ...anamnesis }
  for (const field of CLINICAL_ONLY_FIELDS) delete allowed[field]
  return allowed
}

// Contraseña que reciben los usuarios creados o restablecidos en el modo local de demostración
const LOCAL_TEMPORARY_PASSWORD = 'Aspar2026!'

export function createUser(
  name: string,
  email: string,
  role: UserRole,
  department = 'General',
): User {
  const users = getUsers()
  const cleanName = name.trim()
  const cleanEmail = email.trim().toLowerCase()

  if (cleanName.length < 3) {
    throw new Error('El nombre del usuario debe tener al menos 3 caracteres.')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Ingresa un correo electrónico institucional válido.')
  }

  if (users.some((user) => user.email.toLowerCase() === cleanEmail)) {
    throw new Error('Ya existe un usuario con ese correo.')
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    role,
    department: department.trim() || 'General',
    active: true,
    createdAt: new Date().toISOString(),
  }

  DEMO_PASSWORDS[cleanEmail] = LOCAL_TEMPORARY_PASSWORD
  writeStorage('aspar_users', [...users, user])
  addAudit(
    'Creación de usuario',
    `Creó ${user.email} con rol ${role} (${user.department})`,
    'USUARIOS_ROLES',
    'WARNING',
  )

  asparApiClient
    .createUser({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    })
    .catch(() => undefined)

  return user
}

export type UserCredentialResult = {
  user: User
  temporaryPassword: string | null
}

/**
 * RF-11 (SCRUM-161): crea el usuario en la API y devuelve la contraseña temporal
 * que genera el Backend, para mostrarla una sola vez al Administrador.
 */
export async function createUserWithApi(
  name: string,
  email: string,
  role: UserRole,
  department = 'General',
): Promise<UserCredentialResult> {
  try {
    const { temporaryPassword, ...user } = await asparApiClient.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      department: department.trim() || 'General',
    })
    writeStorage('aspar_users', [
      ...getUsers().filter((item) => item.id !== user.id),
      user,
    ])
    return { user, temporaryPassword: temporaryPassword ?? null }
  } catch (cause) {
    if (cause instanceof ApiError) throw new Error(cause.message, { cause })
    if (!isLocalModeAllowed()) {
      throw new Error(
        'No se pudo conectar con el servidor. El usuario no se creó.',
        { cause },
      )
    }
    const user = createUser(name, email, role, department)
    return { user, temporaryPassword: LOCAL_TEMPORARY_PASSWORD }
  }
}

/** RF-11: restablece la contraseña de un usuario y devuelve la temporal nueva. */
export async function resetUserPassword(user: User): Promise<string | null> {
  try {
    const response = await asparApiClient.resetPassword(user.id)
    return response.temporaryPassword ?? null
  } catch (cause) {
    if (cause instanceof ApiError) throw new Error(cause.message, { cause })
    if (!isLocalModeAllowed()) {
      throw new Error(
        'No se pudo conectar con el servidor. La contraseña no se cambió.',
        { cause },
      )
    }
    DEMO_PASSWORDS[user.email.toLowerCase()] = LOCAL_TEMPORARY_PASSWORD
    addAudit(
      'Restablecimiento de contraseña',
      `Restableció la contraseña de ${user.email}`,
      'USUARIOS_ROLES',
      'WARNING',
    )
    return LOCAL_TEMPORARY_PASSWORD
  }
}

export function updateUser(
  id: string,
  changes: Partial<Pick<User, 'role' | 'active' | 'department'>>,
): void {
  const users = getUsers()
  const updatedUsers = users.map((user) =>
    user.id === id ? { ...user, ...changes } : user,
  )

  writeStorage('aspar_users', updatedUsers)
  const target = updatedUsers.find((u) => u.id === id)
  addAudit(
    'Actualización de usuario y rol',
    `Actualizó el usuario ${target?.email ?? id} (rol=${target?.role}, activo=${target?.active})`,
    'USUARIOS_ROLES',
    target?.active === false ? 'CRITICAL' : 'WARNING',
  )

  asparApiClient.patchUser(id, changes).catch(() => undefined)
}

const ATTENDANCE_STORAGE_KEY = 'aspar_attendance'

function dateInDays(offset: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDefaultAttendance(): AttendanceEntry[] {
  return [
    {
      id: 'a-1',
      patientId: 'p-1',
      patientName: 'Elena Rojas',
      date: dateInDays(1),
      time: '09:00',
      activity: 'Terapia física grupal',
      status: 'Pendiente',
    },
    {
      id: 'a-2',
      patientId: 'p-2',
      patientName: 'Miguel Fernández',
      date: dateInDays(1),
      time: '09:00',
      activity: 'Terapia física grupal',
      status: 'Pendiente',
    },
  ]
}

export function getAttendance(): AttendanceEntry[] {
  return readStorage(ATTENDANCE_STORAGE_KEY, getDefaultAttendance())
}

export function updateAttendance(id: string, status: AttendanceStatus): void {
  const updatedEntries = getAttendance().map((entry) =>
    entry.id === id ? { ...entry, status } : entry,
  )

  writeStorage(ATTENDANCE_STORAGE_KEY, updatedEntries)
  addAudit(
    'Marcación de asistencia',
    `Registro ${id} marcado como ${status}`,
    'CRONOGRAMA',
    'INFO',
  )
}

export const schedule: ScheduleItem[] = [
  {
    id: 's-1',
    date: dateInDays(1),
    time: '09:00',
    title: 'Terapia física grupal y equilibrio',
    category: 'Fisioterapia',
    professional: 'Lic. Ana Flores',
    location: 'Sala de rehabilitación ASPAR',
    spots: 18,
  },
  {
    id: 's-2',
    date: dateInDays(2),
    time: '10:30',
    title: 'Taller de arteterapia y estimulación cognitiva',
    category: 'Arteterapia',
    professional: 'Lic. Marco Rojas',
    location: 'Salón principal',
    spots: 20,
  },
  {
    id: 's-3',
    date: dateInDays(4),
    time: '09:30',
    title: 'Fonoaudiología y proyección de la voz',
    category: 'Fonoaudiología',
    professional: 'Lic. Valeria Camacho',
    location: 'Consultorio 2',
    spots: 12,
  },
]

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    code: 'ASP-MAT-001',
    name: 'Colchonetas de rehabilitación de alta densidad',
    category: 'Fisioterapia',
    quantity: 14,
    origin: 'Préstamo Alcaldía',
    condition: 'Óptimo',
    location: 'Sala de rehabilitación',
    updatedAt: '2026-08-20',
  },
  {
    id: 'inv-2',
    code: 'ASP-MAT-002',
    name: 'Balones terapéuticos Bobath (65 cm)',
    category: 'Fisioterapia',
    quantity: 8,
    origin: 'Donación',
    condition: 'Bueno',
    location: 'Depósito de fisioterapia',
    updatedAt: '2026-08-22',
  },
  {
    id: 'inv-3',
    code: 'ASP-AYU-003',
    name: 'Bastones de apoyo de cuatro puntas',
    category: 'Ayuda Técnica',
    quantity: 10,
    origin: 'Propio ASPAR',
    condition: 'Óptimo',
    location: 'Recepción / Préstamo a pacientes',
    updatedAt: '2026-08-24',
  },
]

export function getInventory(): InventoryItem[] {
  return readStorage('aspar_inventory', DEFAULT_INVENTORY)
}

export function saveInventoryItem(
  item: Omit<InventoryItem, 'id' | 'updatedAt'>,
): InventoryItem {
  const list = getInventory()
  const created: InventoryItem = {
    ...item,
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString().slice(0, 10),
  }
  writeStorage('aspar_inventory', [created, ...list])
  addAudit(
    'Alta de ítem en inventario',
    `Registró ${created.name} (${created.code}) origen: ${created.origin}`,
    'INVENTARIO',
    'INFO',
  )
  return created
}

const DEFAULT_MEDIA: MediaAsset[] = [
  {
    id: 'm-1',
    title: 'Jornada sabatina de fisioterapia motora',
    type: 'Imagen',
    category: 'Terapia Física',
    storageProvider: 'Cloudinary / AWS S3',
    url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
    sizeMb: 2.4,
    uploadedAt: '2026-08-18',
  },
  {
    id: 'm-2',
    title: 'Taller de coro, voz y fonoaudiología',
    type: 'Video',
    category: 'Fonoaudiología',
    storageProvider: 'Cloudinary / AWS S3',
    url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80',
    sizeMb: 14.8,
    uploadedAt: '2026-08-21',
  },
]

export function getMediaAssets(): MediaAsset[] {
  return readStorage('aspar_media', DEFAULT_MEDIA)
}

export function addMediaAsset(
  title: string,
  type: 'Imagen' | 'Video',
  category: string,
  sizeMb: number,
): MediaAsset {
  const assets = getMediaAssets()
  const created: MediaAsset = {
    id: crypto.randomUUID(),
    title: title.trim(),
    type,
    category: category.trim() || 'Actividades Sabatinas',
    storageProvider: 'Cloudinary / AWS S3',
    url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80',
    sizeMb,
    uploadedAt: new Date().toISOString().slice(0, 10),
  }
  writeStorage('aspar_media', [created, ...assets])
  addAudit(
    'Subida de multimedia a Cloud Storage',
    `Archivo ${created.title} (${created.sizeMb} MB) almacenado en S3/Cloudinary (RF-05)`,
    'SISTEMA',
    'INFO',
  )
  return created
}

const DEFAULT_DONATIONS: DonationRecord[] = [
  {
    id: 'don-1',
    donorName: 'Aporte Solidario Anónimo',
    amountBs: 350,
    method: 'QR Bancario',
    purpose: 'Compra de mats de yoga y balones de fisioterapia',
    status: 'Verificado',
    date: '2026-08-19',
  },
  {
    id: 'don-2',
    donorName: 'Familia Viscarra',
    amountBs: 500,
    method: 'Pasarela Libélula',
    purpose: 'Fondo pro-espacio propio de rehabilitación ASPAR',
    status: 'Verificado',
    date: '2026-08-23',
  },
]

export function getDonations(): DonationRecord[] {
  return readStorage('aspar_donations', DEFAULT_DONATIONS)
}

export function registerDonation(
  donorName: string,
  amountBs: number,
  method: DonationRecord['method'],
  purpose: string,
): DonationRecord {
  const donations = getDonations()
  const record: DonationRecord = {
    id: crypto.randomUUID(),
    donorName: donorName.trim() || 'Donante Solidario',
    amountBs,
    method,
    purpose: purpose.trim() || 'Fondo general de rehabilitación ASPAR',
    status: 'Verificado',
    date: new Date().toISOString().slice(0, 10),
  }
  writeStorage('aspar_donations', [record, ...donations])
  addAudit(
    'Registro de donación verificada',
    `Donación de Bs. ${record.amountBs} vía ${record.method} (${record.donorName})`,
    'DONACIONES',
    'INFO',
  )
  return record
}

export const institutionalInfo: InstitutionalInfo = {
  mission:
    'Brindar atención integral, rehabilitación física, fonoaudiológica, psicológica y acompañamiento humano a personas con la enfermedad de Parkinson y a sus familias en La Paz.',
  vision:
    'Consolidar un Centro de Día y clínica abierta en Bolivia inspirado en el modelo de la Corporación CETRAM de Chile.',
  historySummary:
    'La Asociación de Parkinson "Mario Lagrava" (ASPAR) articula especialistas, voluntarios y cuidadores en jornadas sabatinas de rehabilitación motora, cognitiva y emocional.',
  inspirationModel: 'Corporación CETRAM (Chile)',
  enrollmentRequirements: [
    'Fotocopia de Cédula de Identidad del paciente y croquis/dirección de domicilio.',
    'Datos de contacto de un familiar directo o cuidador responsable.',
    'Diagnóstico neurológico de Parkinson u otro trastorno del movimiento (o valoración clínica inicial en ASPAR).',
    'Firma del consentimiento informado para el tratamiento confidencial de datos clínicos (RNF-06).',
  ],
  socialLinks: {
    facebook: 'https://www.facebook.com/aspar.bolivia',
    instagram: 'https://www.instagram.com/aspar.bolivia',
    tiktok: 'https://www.tiktok.com/@aspar.bolivia',
  },
}
