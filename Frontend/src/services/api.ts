/**
 * SCRUM-87 — Cliente HTTP RESTful para integración de punta a punta con el Backend FastAPI.
 * Gestiona cabeceras Authorization: Bearer <JWT>, serialización JSON y sincronización con API real.
 */

import type {
  AuditEvent,
  LoginRequestDto,
  LoginResponseDto,
  Patient,
  RefreshResponseDto,
  Session,
  User,
} from '../types/aspar'

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1'

export function getApiBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL.trim()
      : ''
  return envUrl || DEFAULT_API_BASE_URL
}

function getBearerToken(): string | null {
  const raw = localStorage.getItem('aspar_session')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Session
    return parsed.token || null
  } catch {
    return null
  }
}

/** Error con respuesta HTTP de la API (el servidor sí respondió). */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '')
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const token = getBearerToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = `Error HTTP ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body?.detail) errorDetail = body.detail
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(response.status, errorDetail)
  }

  return (await response.json()) as T
}

export const asparApiClient = {
  login(payload: LoginRequestDto): Promise<LoginResponseDto> {
    return apiRequest<LoginResponseDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  verifySession(): Promise<{ valid: boolean; user: Record<string, unknown> }> {
    return apiRequest<{ valid: boolean; user: Record<string, unknown> }>(
      '/auth/verify',
      { method: 'GET' },
    )
  },

  refresh(): Promise<RefreshResponseDto> {
    return apiRequest<RefreshResponseDto>('/auth/refresh', {
      method: 'POST',
    })
  },

  logout(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
    })
  },

  fetchPatients(): Promise<Patient[]> {
    return apiRequest<Patient[]>('/patients', { method: 'GET' })
  },

  createPatient(payload: Omit<Patient, 'id'>): Promise<Patient> {
    return apiRequest<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  patchPatient(
    id: string,
    changes: Partial<Omit<Patient, 'id'>>,
  ): Promise<Patient> {
    return apiRequest<Patient>(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  fetchUsers(): Promise<User[]> {
    return apiRequest<User[]>('/users', { method: 'GET' })
  },

  createUser(payload: {
    name: string
    email: string
    role: string
    department?: string
  }): Promise<User> {
    return apiRequest<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  patchUser(
    id: string,
    changes: Partial<Pick<User, 'role' | 'active' | 'department'>>,
  ): Promise<User> {
    return apiRequest<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  fetchAuditLogs(params?: {
    category?: string
    severity?: string
  }): Promise<AuditEvent[]> {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.severity) query.set('severity', params.severity)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiRequest<AuditEvent[]>(`/audit${suffix}`, { method: 'GET' })
  },
}
