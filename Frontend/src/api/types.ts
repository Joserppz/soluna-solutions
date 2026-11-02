/**
 * Nombres cortos para los tipos generados en schema.d.ts (contrato OpenAPI).
 * Aquí no se define ningún campo a mano: si la API cambia, cambian estos tipos.
 */
import type { components, operations } from './schema'

type Schemas = components['schemas']
type QueryOf<Op extends keyof operations> = NonNullable<
  operations[Op]['parameters']['query']
>

// Sesión y cuentas
export type SessionOut = Schemas['SessionOut']
export type SessionUser = Schemas['SessionUserOut']
export type Permission = SessionOut['permissions'][number]
export type LoginRequest = Schemas['LoginRequest']
export type GoogleLoginRequest = Schemas['GoogleLoginRequest']
export type RegisterRequest = Schemas['RegisterRequest']
export type EmailRequest = Schemas['EmailRequest']
export type TokenRequest = Schemas['TokenRequest']
export type ResetPasswordRequest = Schemas['ResetPasswordRequest']
export type ChangePasswordRequest = Schemas['ChangePasswordRequest']
export type MessageResponse = Schemas['MessageResponse']

// Afiliados y documentos
export type PatientPage = Schemas['PatientPage']
export type PatientSummary = Schemas['PatientSummaryOut']
export type PatientOut = Schemas['PatientOut']
export type PatientIn = Schemas['PatientIn']
export type PatientUpdate = Schemas['PatientUpdate']
export type PatientDeactivate = Schemas['PatientDeactivate']
export type PatientReactivate = Schemas['PatientReactivate']
export type PatientListQuery = QueryOf<'list_patients_api_v1_patients_get'>
export type PatientCountsQuery =
  QueryOf<'patient_counts_api_v1_patients_summary_get'>
export type PatientCounts = Schemas['PatientCounts']
export type PatientGroup = NonNullable<PatientListQuery['group']>
export type PatientOrder = NonNullable<PatientListQuery['order']>
export type ActivityTag = Schemas['ActivityTag']
export type ActivityOption = Schemas['ActivityOption']
export type PatientAttendancePage = Schemas['PatientAttendancePage']
export type PatientAttendanceRecord = Schemas['PatientAttendanceRecord']
export type PatientDocument = Schemas['PatientDocumentOut']
export type SignedUrl = Schemas['SignedUrlOut']
export type ContactIn = Schemas['ContactIn']
export type ContactOut = Schemas['ContactOut']
export type ContactUpdate = Schemas['ContactUpdate']
export type EvaluationIn = Schemas['EvaluationIn']
export type EvaluationOut = Schemas['EvaluationOut']
export type EvaluationUpdate = Schemas['EvaluationUpdate']
export type EvaluationRemove = Schemas['EvaluationRemove']
export type EvaluationArea = EvaluationOut['area']

// Equipo
export type UserPage = Schemas['UserPage']
export type UserOut = Schemas['UserOut']
export type UserCreate = Schemas['UserCreate']
export type UserCreated = Schemas['UserCreated']
export type UserUpdate = Schemas['UserUpdate']
export type UserListQuery = QueryOf<'list_users_api_v1_users_get'>
export type PasswordResetOut = Schemas['PasswordResetOut']
export type UserApprove = Schemas['UserApprove']

// Roles y permisos
export type RoleMatrix = Schemas['RoleMatrixOut']
export type RoleOut = Schemas['RoleOut']
export type PermissionInfo = Schemas['PermissionOut']
export type RolePermissionsUpdate = Schemas['RolePermissionsUpdate']

// Actividades
export type ScheduleIn = Schemas['ScheduleIn']
export type ScheduleOut = Schemas['ScheduleOut']
export type ScheduleUpdate = Schemas['ScheduleUpdate']
export type ScheduleCancel = Schemas['ScheduleCancel']
export type SchedulePage = Schemas['SchedulePage']
export type ScheduleListQuery = QueryOf<'list_schedules_api_v1_schedules_get'>
export type PublicSchedule = Schemas['PublicScheduleOut']
export type PublicScheduleQuery =
  QueryOf<'public_schedules_api_v1_public_schedules_get'>

// Asistencia
export type AttendanceSheet = Schemas['AttendanceSheetOut']
export type AttendanceEntry = Schemas['AttendanceEntryOut']
export type AttendanceMark = Schemas['AttendanceMark']
export type AttendanceStatus = AttendanceMark['status']
export type NewcomerIn = Schemas['NewcomerIn']
export type NewcomerOut = Schemas['NewcomerOut']
export type MonthlySummary = Schemas['MonthlySummaryOut']

// Inventario
export type ItemIn = Schemas['ItemIn']
export type ItemOut = Schemas['ItemOut']
export type ItemUpdate = Schemas['ItemUpdate']
export type ItemPage = Schemas['ItemPage']
export type ItemDeactivate = Schemas['ItemDeactivate']
export type ItemListQuery = QueryOf<'list_items_api_v1_inventory_get'>
export type MovementIn = Schemas['MovementIn']
export type MovementOut = Schemas['MovementOut']
export type InventorySummary = Schemas['InventorySummary']

// Donaciones
export type DonationNoticeIn = Schemas['DonationNoticeIn']
export type DonationTracking = Schemas['DonationTrackingOut']
export type PublicGoal = Schemas['PublicGoalOut']
export type DonationOut = Schemas['DonationOut']
export type DonationPage = Schemas['DonationPage']
export type DonationListQuery = QueryOf<'list_donations_api_v1_donations_get'>
export type DonationConfirm = Schemas['DonationConfirm']
export type DonationCancel = Schemas['DonationCancel']
export type DonationManualIn = Schemas['DonationManualIn']
export type DonationSummary = Schemas['DonationSummary']
export type GoalIn = Schemas['GoalIn']
export type GoalOut = Schemas['GoalOut']

// Galería
export type AlbumIn = Schemas['AlbumIn']
export type AlbumUpdate = Schemas['AlbumUpdate']
export type AlbumOut = Schemas['AlbumOut']
export type AlbumSummary = Schemas['AlbumSummaryOut']
export type AlbumPublish = Schemas['AlbumPublish']
export type AssetIn = Schemas['AssetIn']
export type AssetOut = Schemas['AssetOut']
export type UploadSignature = Schemas['UploadSignatureOut']
export type PublicAlbum = Schemas['PublicAlbumOut']
export type PublicAlbumSummary = Schemas['PublicAlbumSummaryOut']

// Contenido del sitio
export type SectionOut = Schemas['SectionOut']
export type SectionDraftIn = Schemas['SectionDraftIn']
export type SocialLinksIn = Schemas['SocialLinksIn']
export type PublicSection = Schemas['PublicSectionOut']

// Solicitudes
export type PublicInquiryIn = Schemas['PublicInquiryIn']
export type InquiryOut = Schemas['InquiryOut']
export type InquiryDetail = Schemas['InquiryDetailOut']
export type InquiryPage = Schemas['InquiryPage']
export type InquiryListQuery = QueryOf<'list_inquiries_api_v1_inquiries_get'>
export type InquiryUpdate = Schemas['InquiryUpdate']
export type InquirySummary = Schemas['InquirySummary']
export type NoteIn = Schemas['NoteIn']
export type PatientDraft = Schemas['PatientDraftOut']
export type InquiryConvert = Schemas['InquiryConvert']

// Panel
export type DashboardSummary = Schemas['DashboardSummary']

// Bitácora
export type AuditPage = Schemas['AuditPage']
export type AuditEvent = Schemas['AuditEventOut']
export type AuditListQuery = QueryOf<'list_audit_events_api_v1_audit_get'>
export type AuditExportQuery = QueryOf<'export_audit_api_v1_audit_export_get'>
export type AuditSummary = Schemas['AuditSummary']
export type AuditArea = NonNullable<AuditEvent['area']>
export type AuditReviewKind = NonNullable<AuditEvent['review']>
