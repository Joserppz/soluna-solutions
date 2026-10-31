/**
 * Un método por endpoint de la API, con los tipos del contrato OpenAPI.
 * Las vistas usan estos métodos; ninguna arma URLs ni cuerpos a mano.
 */
import type { HttpClient } from './client'
import type {
  AuditListQuery,
  AuditPage,
  ChangePasswordRequest,
  EmailRequest,
  GoogleLoginRequest,
  LoginRequest,
  MessageResponse,
  PasswordResetOut,
  RoleMatrix,
  RoleOut,
  RolePermissionsUpdate,
  PatientDeactivate,
  PatientDocument,
  PatientIn,
  PatientListQuery,
  PatientOut,
  PatientPage,
  PatientUpdate,
  RegisterRequest,
  ResetPasswordRequest,
  SessionOut,
  SignedUrl,
  TokenRequest,
  UserCreate,
  UserApprove,
  UserCreated,
  UserListQuery,
  UserOut,
  UserPage,
  UserUpdate,
} from './types'

const id = (value: string) => encodeURIComponent(value)

export function createEndpoints(http: HttpClient) {
  return {
    auth: {
      login: (body: LoginRequest) =>
        http.post<SessionOut>('/auth/login', { body, anonymous: true }),
      loginWithGoogle: (body: GoogleLoginRequest) =>
        http.post<SessionOut>('/auth/google', { body, anonymous: true }),
      me: () => http.get<SessionOut>('/auth/me'),
      refresh: () => http.post<SessionOut>('/auth/refresh'),
      logout: () => http.post<MessageResponse>('/auth/logout'),
      register: (body: RegisterRequest) =>
        http.post<MessageResponse>('/auth/register', { body, anonymous: true }),
      verifyEmail: (body: TokenRequest) =>
        http.post<MessageResponse>('/auth/verify-email', {
          body,
          anonymous: true,
        }),
      resendVerification: (body: EmailRequest) =>
        http.post<MessageResponse>('/auth/resend-verification', {
          body,
          anonymous: true,
        }),
      forgotPassword: (body: EmailRequest) =>
        http.post<MessageResponse>('/auth/forgot-password', {
          body,
          anonymous: true,
        }),
      resetPassword: (body: ResetPasswordRequest) =>
        http.post<MessageResponse>('/auth/reset-password', {
          body,
          anonymous: true,
        }),
      changePassword: (body: ChangePasswordRequest) =>
        http.post<SessionOut>('/auth/change-password', { body }),
    },

    patients: {
      list: (query: PatientListQuery = {}) =>
        http.get<PatientPage>('/patients', { query }),
      get: (patientId: string) =>
        http.get<PatientOut>(`/patients/${id(patientId)}`),
      create: (body: PatientIn) => http.post<PatientOut>('/patients', { body }),
      update: (patientId: string, body: PatientUpdate) =>
        http.patch<PatientOut>(`/patients/${id(patientId)}`, { body }),
      deactivate: (patientId: string, body: PatientDeactivate) =>
        http.post<PatientOut>(`/patients/${id(patientId)}/deactivate`, {
          body,
        }),
      reactivate: (patientId: string) =>
        http.post<PatientOut>(`/patients/${id(patientId)}/reactivate`),
    },

    documents: {
      list: (patientId: string) =>
        http.get<PatientDocument[]>(`/patients/${id(patientId)}/documents`),
      upload: (
        patientId: string,
        documentType: string,
        file: Blob,
        fileName?: string,
      ) => {
        const form = new FormData()
        form.append('documentType', documentType)
        form.append('file', file, fileName)
        return http.post<PatientDocument>(
          `/patients/${id(patientId)}/documents`,
          { form },
        )
      },
      signedUrl: (patientId: string, documentId: string) =>
        http.get<SignedUrl>(
          `/patients/${id(patientId)}/documents/${id(documentId)}/url`,
        ),
      remove: (patientId: string, documentId: string) =>
        http.delete<MessageResponse>(
          `/patients/${id(patientId)}/documents/${id(documentId)}`,
        ),
    },

    users: {
      list: (query: UserListQuery = {}) =>
        http.get<UserPage>('/users', { query }),
      create: (body: UserCreate) => http.post<UserCreated>('/users', { body }),
      update: (userId: string, body: UserUpdate) =>
        http.patch<UserOut>(`/users/${id(userId)}`, { body }),
      resetPassword: (userId: string) =>
        http.post<PasswordResetOut>(`/users/${id(userId)}/reset-password`),
      approve: (userId: string, body: UserApprove) =>
        http.post<UserOut>(`/users/${id(userId)}/approve`, { body }),
    },

    roles: {
      matrix: () => http.get<RoleMatrix>('/roles'),
      updatePermissions: (roleKey: string, body: RolePermissionsUpdate) =>
        http.put<RoleOut>(`/roles/${id(roleKey)}/permissions`, { body }),
    },

    audit: {
      list: (query: AuditListQuery = {}) =>
        http.get<AuditPage>('/audit', { query }),
    },
  }
}

export type AsparApi = ReturnType<typeof createEndpoints>
