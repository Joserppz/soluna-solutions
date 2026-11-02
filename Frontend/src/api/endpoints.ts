/**
 * Un método por endpoint de la API, con los tipos del contrato OpenAPI.
 * Las vistas usan estos métodos; ninguna arma URLs ni cuerpos a mano.
 */
import type { HttpClient } from './client'
import type {
  AlbumIn,
  AlbumOut,
  AlbumPublish,
  AlbumSummary,
  AlbumUpdate,
  AssetIn,
  AssetOut,
  AttendanceEntry,
  AttendanceMark,
  AttendanceSheet,
  AuditExportQuery,
  AuditListQuery,
  AuditSummary,
  AuditPage,
  ChangePasswordRequest,
  DonationCancel,
  DonationConfirm,
  DonationListQuery,
  DonationManualIn,
  DonationNoticeIn,
  DonationOut,
  DonationPage,
  DonationSummary,
  DonationTracking,
  ContactIn,
  ContactOut,
  ContactUpdate,
  DashboardSummary,
  EmailRequest,
  EvaluationArea,
  EvaluationIn,
  EvaluationOut,
  EvaluationRemove,
  EvaluationUpdate,
  GoalIn,
  GoalOut,
  GoogleLoginRequest,
  InquiryConvert,
  InquiryDetail,
  InquiryListQuery,
  InquiryPage,
  InquirySummary,
  InquiryUpdate,
  InventorySummary,
  ItemDeactivate,
  ItemIn,
  ItemListQuery,
  ItemOut,
  ItemPage,
  ItemUpdate,
  LoginRequest,
  MessageResponse,
  MovementIn,
  MovementOut,
  MonthlySummary,
  NewcomerIn,
  NewcomerOut,
  NoteIn,
  PatientDraft,
  PasswordResetOut,
  RoleMatrix,
  RoleOut,
  RolePermissionsUpdate,
  PatientDeactivate,
  PatientDocument,
  PatientIn,
  PatientListQuery,
  PatientAttendancePage,
  PatientCounts,
  PatientCountsQuery,
  PatientOut,
  PatientPage,
  PatientReactivate,
  PatientUpdate,
  RegisterRequest,
  ResetPasswordRequest,
  PublicAlbum,
  PublicAlbumSummary,
  PublicGoal,
  PublicInquiryIn,
  PublicSection,
  PublicSchedule,
  PublicScheduleQuery,
  ScheduleCancel,
  ScheduleIn,
  ScheduleListQuery,
  ScheduleOut,
  SchedulePage,
  ScheduleUpdate,
  SectionDraftIn,
  SectionOut,
  SessionOut,
  SocialLinksIn,
  SignedUrl,
  TokenRequest,
  UploadSignature,
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
      /** Contadores de las pestañas y opciones del filtro por actividad. */
      summary: (query: PatientCountsQuery = {}) =>
        http.get<PatientCounts>('/patients/summary', { query }),
      /** Pestaña Asistencia: sábados del trimestre e historial paginado. */
      attendance: (
        patientId: string,
        page: { limit?: number; offset?: number } = {},
      ) =>
        http.get<PatientAttendancePage>(
          `/patients/${id(patientId)}/attendance`,
          { query: page },
        ),
      get: (patientId: string) =>
        http.get<PatientOut>(`/patients/${id(patientId)}`),
      create: (body: PatientIn) => http.post<PatientOut>('/patients', { body }),
      update: (patientId: string, body: PatientUpdate) =>
        http.patch<PatientOut>(`/patients/${id(patientId)}`, { body }),
      deactivate: (patientId: string, body: PatientDeactivate) =>
        http.post<PatientOut>(`/patients/${id(patientId)}/deactivate`, {
          body,
        }),
      reactivate: (patientId: string, body: PatientReactivate) =>
        http.post<PatientOut>(`/patients/${id(patientId)}/reactivate`, {
          body,
        }),
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
      /** Quita una evaluación registrada por error (se conserva con su motivo). */
      remove: (
        patientId: string,
        evaluationId: string,
        body: EvaluationRemove,
      ) =>
        http.post<MessageResponse>(
          `/patients/${id(patientId)}/evaluations/${id(evaluationId)}/remove`,
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

    inventory: {
      list: (query: ItemListQuery = {}) =>
        http.get<ItemPage>('/inventory', { query }),
      summary: () => http.get<InventorySummary>('/inventory/summary'),
      get: (itemId: string) => http.get<ItemOut>(`/inventory/${id(itemId)}`),
      create: (body: ItemIn) => http.post<ItemOut>('/inventory', { body }),
      update: (itemId: string, body: ItemUpdate) =>
        http.patch<ItemOut>(`/inventory/${id(itemId)}`, { body }),
      movements: (itemId: string) =>
        http.get<MovementOut[]>(`/inventory/${id(itemId)}/movements`),
      addMovement: (itemId: string, body: MovementIn) =>
        http.post<MovementOut>(`/inventory/${id(itemId)}/movements`, { body }),
      deactivate: (itemId: string, body: ItemDeactivate) =>
        http.post<ItemOut>(`/inventory/${id(itemId)}/deactivate`, { body }),
      /** Archivo para la rendición de cuentas (la Alcaldía va aparte). */
      export: (format: 'csv' | 'xlsx' = 'xlsx') =>
        http.get<Blob>('/inventory/export', { query: { format }, blob: true }),
    },

    donations: {
      list: (query: DonationListQuery = {}) =>
        http.get<DonationPage>('/donations', { query }),
      summary: (month?: string) =>
        http.get<DonationSummary>('/donations/summary', { query: { month } }),
      /** «Descargar resumen del mes»: resumen y detalle de los aportes. */
      downloadSummary: (format: 'csv' | 'xlsx', month?: string) =>
        http.get<Blob>('/donations/summary', {
          query: { month, format },
          blob: true,
        }),
      get: (donationId: string) =>
        http.get<DonationOut>(`/donations/${id(donationId)}`),
      /** Aporte recibido en la sede: efectivo o en especie. */
      registerReceived: (body: DonationManualIn) =>
        http.post<DonationOut>('/donations', { body }),
      confirm: (donationId: string, body: DonationConfirm) =>
        http.post<DonationOut>(`/donations/${id(donationId)}/confirm`, {
          body,
        }),
      cancel: (donationId: string, body: DonationCancel) =>
        http.post<DonationOut>(`/donations/${id(donationId)}/cancel`, { body }),
      goal: () => http.get<GoalOut | null>('/donations/goal'),
      saveGoal: (body: GoalIn) =>
        http.put<GoalOut>('/donations/goal', { body }),
    },

    media: {
      albums: (visibility?: 'privado' | 'publico') =>
        http.get<AlbumSummary[]>('/media/albums', { query: { visibility } }),
      album: (albumId: string) =>
        http.get<AlbumOut>(`/media/albums/${id(albumId)}`),
      createAlbum: (body: AlbumIn) =>
        http.post<AlbumOut>('/media/albums', { body }),
      updateAlbum: (albumId: string, body: AlbumUpdate) =>
        http.patch<AlbumOut>(`/media/albums/${id(albumId)}`, { body }),
      deleteAlbum: (albumId: string) =>
        http.delete<MessageResponse>(`/media/albums/${id(albumId)}`),
      /** Firma para subir directo a Cloudinary; luego se registra con addAsset. */
      uploadSignature: (albumId: string) =>
        http.post<UploadSignature>(
          `/media/albums/${id(albumId)}/upload-signature`,
        ),
      addAsset: (albumId: string, body: AssetIn) =>
        http.post<AssetOut>(`/media/albums/${id(albumId)}/assets`, { body }),
      removeAsset: (assetId: string) =>
        http.delete<MessageResponse>(`/media/assets/${id(assetId)}`),
      setTags: (assetId: string, patientIds: string[]) =>
        http.put<AssetOut>(`/media/assets/${id(assetId)}/tags`, {
          body: { patientIds },
        }),
      publish: (albumId: string, body: AlbumPublish) =>
        http.post<AlbumOut>(`/media/albums/${id(albumId)}/publish`, { body }),
      unpublish: (albumId: string) =>
        http.post<AlbumOut>(`/media/albums/${id(albumId)}/unpublish`),
    },

    content: {
      sections: () => http.get<SectionOut[]>('/content/sections'),
      section: (key: string) =>
        http.get<SectionOut>(`/content/sections/${id(key)}`),
      saveDraft: (key: string, body: SectionDraftIn) =>
        http.put<SectionOut>(`/content/sections/${id(key)}`, { body }),
      publish: (key: string) =>
        http.post<SectionOut>(`/content/sections/${id(key)}/publish`),
      saveSocialLinks: (body: SocialLinksIn) =>
        http.put<SectionOut>('/content/social-links', { body }),
    },

    inquiries: {
      list: (query: InquiryListQuery = {}) =>
        http.get<InquiryPage>('/inquiries', { query }),
      summary: () => http.get<InquirySummary>('/inquiries/summary'),
      get: (inquiryId: string) =>
        http.get<InquiryDetail>(`/inquiries/${id(inquiryId)}`),
      update: (inquiryId: string, body: InquiryUpdate) =>
        http.patch<InquiryDetail>(`/inquiries/${id(inquiryId)}`, { body }),
      addNote: (inquiryId: string, body: NoteIn) =>
        http.post<InquiryDetail>(`/inquiries/${id(inquiryId)}/notes`, { body }),
      patientDraft: (inquiryId: string) =>
        http.get<PatientDraft>(`/inquiries/${id(inquiryId)}/patient-draft`),
      /** «Inscribir como afiliado»: abre la ficha nueva. */
      convertToPatient: (inquiryId: string, body: InquiryConvert) =>
        http.post<PatientOut>(
          `/inquiries/${id(inquiryId)}/convert-to-patient`,
          { body },
        ),
    },

    dashboard: {
      summary: () => http.get<DashboardSummary>('/dashboard/summary'),
    },

    system: {
      /** La API responde (sin consultar la base). */
      health: () =>
        http.get<Record<string, unknown>>('/health', { anonymous: true }),
      /** La API llega a PostgreSQL. */
      healthDb: () =>
        http.get<Record<string, unknown>>('/health/db', { anonymous: true }),
    },

    public: {
      // Sin sesión: la agenda del sitio
      schedules: (query: PublicScheduleQuery = {}) =>
        http.get<PublicSchedule[]>('/public/schedules', {
          query,
          anonymous: true,
        }),
      donationGoal: () =>
        http.get<PublicGoal | null>('/public/donations/goal', {
          anonymous: true,
        }),
      /** «Ya hice mi aporte» (QR bancario): queda pendiente hasta confirmarlo. */
      notifyDonation: (body: DonationNoticeIn) =>
        http.post<DonationTracking>('/public/donations/notice', {
          body,
          anonymous: true,
        }),
      albums: () =>
        http.get<PublicAlbumSummary[]>('/public/media/albums', {
          anonymous: true,
        }),
      album: (albumId: string) =>
        http.get<PublicAlbum>(`/public/media/albums/${id(albumId)}`, {
          anonymous: true,
        }),
      content: () =>
        http.get<PublicSection[]>('/public/content', { anonymous: true }),
      section: (key: string) =>
        http.get<PublicSection>(`/public/content/${id(key)}`, {
          anonymous: true,
        }),
      /** Orientación, voluntariado, especie, «Quiero participar» u otro motivo. */
      sendInquiry: (body: PublicInquiryIn) =>
        http.post<MessageResponse>('/public/inquiries', {
          body,
          anonymous: true,
        }),
      trackDonation: (donationId: string) =>
        http.get<DonationTracking>(
          `/public/donations/notice/${id(donationId)}`,
          { anonymous: true },
        ),
    },

    audit: {
      /** Registro de actividad: área, persona o afiliado, días y situaciones para revisar. */
      list: (query: AuditListQuery = {}) =>
        http.get<AuditPage>('/audit', { query }),
      /** Movimientos por área y situaciones para revisar de los últimos días. */
      summary: (days = 7) =>
        http.get<AuditSummary>('/audit/summary', { query: { days } }),
      /** «Descargar registro»: lo filtrado, en CSV o Excel (queda registrado). */
      download: (query: AuditExportQuery = {}) =>
        http.get<Blob>('/audit/export', { query, blob: true }),
    },
  }
}

export type AsparApi = ReturnType<typeof createEndpoints>
