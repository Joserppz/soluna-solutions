/**
 * Un método por endpoint de la API, con los tipos del contrato OpenAPI.
 * Las vistas usan estos métodos; ninguna arma URLs ni cuerpos a mano.
 */
import type { HttpClient } from './client'
import type {
  AttendanceEntry,
  AttendanceMark,
  AttendanceSheet,
  AuditListQuery,
  AuditPage,
  ChangePasswordRequest,
  ContactIn,
  ContactOut,
  ContactUpdate,
  EmailRequest,
  EvaluationArea,
  EvaluationIn,
  EvaluationOut,
  EvaluationUpdate,
  GoogleLoginRequest,
  LoginRequest,
  MessageResponse,
  MonthlySummary,
  NewcomerIn,
  NewcomerOut,
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
  PublicSchedule,
  PublicScheduleQuery,
  ScheduleCancel,
  ScheduleIn,
  ScheduleListQuery,
  ScheduleOut,
  SchedulePage,
  ScheduleUpdate,
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

    contacts: {
      list: (patientId: string) =>
        http.get<ContactOut[]>(`/patients/${id(patientId)}/contacts`),
      add: (patientId: string, body: ContactIn) =>
        http.post<ContactOut>(`/patients/${id(patientId)}/contacts`, { body }),
      update: (patientId: string, contactId: string, body: ContactUpdate) =>
        http.patch<ContactOut>(
          `/patients/${id(patientId)}/contacts/${id(contactId)}`,
          { body },
        ),
      remove: (patientId: string, contactId: string) =>
        http.delete<MessageResponse>(
          `/patients/${id(patientId)}/contacts/${id(contactId)}`,
        ),
    },

    evaluations: {
      list: (patientId: string, area?: EvaluationArea) =>
        http.get<EvaluationOut[]>(`/patients/${id(patientId)}/evaluations`, {
          query: { area },
        }),
      get: (patientId: string, evaluationId: string) =>
        http.get<EvaluationOut>(
          `/patients/${id(patientId)}/evaluations/${id(evaluationId)}`,
        ),
      create: (patientId: string, body: EvaluationIn) =>
        http.post<EvaluationOut>(`/patients/${id(patientId)}/evaluations`, {
          body,
        }),
      update: (
        patientId: string,
        evaluationId: string,
        body: EvaluationUpdate,
      ) =>
        http.patch<EvaluationOut>(
          `/patients/${id(patientId)}/evaluations/${id(evaluationId)}`,
          { body },
        ),
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

    schedules: {
      list: (query: ScheduleListQuery = {}) =>
        http.get<SchedulePage>('/schedules', { query }),
      get: (scheduleId: string) =>
        http.get<ScheduleOut>(`/schedules/${id(scheduleId)}`),
      create: (body: ScheduleIn) =>
        http.post<ScheduleOut>('/schedules', { body }),
      update: (scheduleId: string, body: ScheduleUpdate) =>
        http.patch<ScheduleOut>(`/schedules/${id(scheduleId)}`, { body }),
      publish: (scheduleId: string) =>
        http.post<ScheduleOut>(`/schedules/${id(scheduleId)}/publish`),
      unpublish: (scheduleId: string) =>
        http.post<ScheduleOut>(`/schedules/${id(scheduleId)}/unpublish`),
      cancel: (scheduleId: string, body: ScheduleCancel) =>
        http.post<ScheduleOut>(`/schedules/${id(scheduleId)}/cancel`, { body }),
      remove: (scheduleId: string) =>
        http.delete<MessageResponse>(`/schedules/${id(scheduleId)}`),
    },

    attendance: {
      sheet: (scheduleId: string, search?: string) =>
        http.get<AttendanceSheet>(`/schedules/${id(scheduleId)}/attendance`, {
          query: { search },
        }),
      mark: (scheduleId: string, patientId: string, body: AttendanceMark) =>
        http.put<AttendanceEntry>(
          `/schedules/${id(scheduleId)}/attendance/${id(patientId)}`,
          { body },
        ),
      markAllPresent: (scheduleId: string) =>
        http.post<AttendanceSheet>(
          `/schedules/${id(scheduleId)}/attendance/mark-all-present`,
        ),
      close: (scheduleId: string) =>
        http.post<AttendanceSheet>(
          `/schedules/${id(scheduleId)}/attendance/close`,
        ),
      reopen: (scheduleId: string) =>
        http.post<AttendanceSheet>(
          `/schedules/${id(scheduleId)}/attendance/reopen`,
        ),
      addNewcomer: (scheduleId: string, body: NewcomerIn) =>
        http.post<NewcomerOut>(
          `/schedules/${id(scheduleId)}/attendance/newcomers`,
          { body },
        ),
      monthly: (month?: string) =>
        http.get<MonthlySummary>('/attendance/monthly', { query: { month } }),
      /** Archivo del resumen mensual para descargar (CSV o Excel). */
      downloadMonthly: (format: 'csv' | 'xlsx', month?: string) =>
        http.get<Blob>('/attendance/monthly', {
          query: { month, format },
          blob: true,
        }),
    },

    public: {
      // Sin sesión: la agenda del sitio
      schedules: (query: PublicScheduleQuery = {}) =>
        http.get<PublicSchedule[]>('/public/schedules', {
          query,
          anonymous: true,
        }),
    },

    audit: {
      list: (query: AuditListQuery = {}) =>
        http.get<AuditPage>('/audit', { query }),
    },
  }
}

export type AsparApi = ReturnType<typeof createEndpoints>
