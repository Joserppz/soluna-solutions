export type UserRole = 'Administrador' | 'Profesional' | 'Recepción'
export type AccessStatus = 'Activo' | 'Pendiente' | 'Revocado'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
}

export interface Patient {
  id: string
  name: string
  ci: string
  phone: string
  emergencyContact: string
  consent: boolean
  accessStatus: AccessStatus
}

export interface Session {
  userId: string
  name: string
  email: string
  role: UserRole
  expiresAt: number
  lastActivityAt: number
}

export interface AuditEvent {
  id: string
  date: string
  actor: string
  action: string
  detail: string
}

const SESSION_MAX_AGE = 30 * 60 * 1000
const SESSION_IDLE_LIMIT = 15 * 60 * 1000

const DEMO_USERS: User[] = [
  {
    id: 'u-admin',
    name: 'Administrador ASPAR',
    email: 'admin@aspar.org',
    role: 'Administrador',
    active: true,
  },
  {
    id: 'u-demo',
    name: 'Usuario de demostración',
    email: 'demo@aspar.org',
    role: 'Profesional',
    active: true,
  },
]

const DEMO_PASSWORDS: Record<string, string> = {
  'admin@aspar.org': 'Admin2026!',
  'demo@aspar.org': 'Aspar2026!',
}

const DEMO_PATIENTS: Patient[] = [
  {
    id: 'p-1',
    name: 'Elena Rojas',
    ci: '1234567',
    phone: '70000001',
    emergencyContact: 'Carlos Rojas',
    consent: true,
    accessStatus: 'Activo',
  },
  {
    id: 'p-2',
    name: 'Miguel Fernández',
    ci: '7654321',
    phone: '70000002',
    emergencyContact: 'Lucía Fernández',
    consent: false,
    accessStatus: 'Pendiente',
  },
]

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

function addAudit(action: string, detail: string): void {
  const session = getSession()
  const events = getAuditEvents()

  events.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    actor: session?.email ?? 'Sistema',
    action,
    detail,
  })

  writeStorage('aspar_audit', events.slice(0, 500))
}

export function getUsers(): User[] {
  return readStorage('aspar_users', DEMO_USERS)
}

export function getPatients(): Patient[] {
  return readStorage('aspar_patients', DEMO_PATIENTS)
}

export function getAuditEvents(): AuditEvent[] {
  return readStorage<AuditEvent[]>('aspar_audit', [])
}

export function getSession(): Session | null {
  const raw = localStorage.getItem('aspar_session')

  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    const now = Date.now()
    const expired =
      now >= session.expiresAt ||
      now - session.lastActivityAt >= SESSION_IDLE_LIMIT

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

export function signIn(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  const user = getUsers().find(
    (item) => item.email.toLowerCase() === normalizedEmail,
  )

  if (
    !user ||
    !user.active ||
    DEMO_PASSWORDS[normalizedEmail] !== password
  ) {
    return false
  }

  const now = Date.now()
  const session: Session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    expiresAt: now + SESSION_MAX_AGE,
    lastActivityAt: now,
  }

  writeStorage('aspar_session', session)
  addAudit('Inicio de sesión', `Ingresó ${user.email}`)
  return true
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

export function signOut(): void {
  const session = getSession()

  if (session) {
    addAudit('Cierre de sesión', `Cerró sesión ${session.email}`)
  }

  localStorage.removeItem('aspar_session')
}

export function savePatient(
  patient: Omit<Patient, 'id'>,
): Patient {
  const patients = getPatients()
  const newPatient: Patient = {
    ...patient,
    id: crypto.randomUUID(),
  }

  writeStorage('aspar_patients', [...patients, newPatient])
  addAudit('Registro de paciente', `Registró a ${newPatient.name}`)
  return newPatient
}

export function updatePatient(
  id: string,
  changes: Partial<Omit<Patient, 'id'>>,
): void {
  const patients = getPatients()
  const updatedPatients = patients.map((patient) =>
    patient.id === id ? { ...patient, ...changes } : patient,
  )

  writeStorage('aspar_patients', updatedPatients)
  addAudit('Actualización de paciente', `Actualizó el registro ${id}`)
}

export function createUser(
  name: string,
  email: string,
  role: UserRole,
): User {
  const users = getUsers()

  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese correo.')
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    active: true,
  }

  writeStorage('aspar_users', [...users, user])
  addAudit('Creación de usuario', `Creó ${user.email} con rol ${role}`)
  return user
}

export function updateUser(
  id: string,
  changes: Partial<Pick<User, 'role' | 'active'>>,
): void {
  const users = getUsers()
  const updatedUsers = users.map((user) =>
    user.id === id ? { ...user, ...changes } : user,
  )

  writeStorage('aspar_users', updatedUsers)
  addAudit('Actualización de usuario', `Actualizó el usuario ${id}`)
}