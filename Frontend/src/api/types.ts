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
export type PatientListQuery = QueryOf<'list_patients_api_v1_patients_get'>
export type PatientDocument = Schemas['PatientDocumentOut']
export type SignedUrl = Schemas['SignedUrlOut']
export type ContactIn = Schemas['ContactIn']
export type ContactOut = Schemas['ContactOut']
export type ContactUpdate = Schemas['ContactUpdate']
export type EvaluationIn = Schemas['EvaluationIn']
export type EvaluationOut = Schemas['EvaluationOut']
export type EvaluationUpdate = Schemas['EvaluationUpdate']
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

// Bitácora
export type AuditPage = Schemas['AuditPage']
export type AuditEvent = Schemas['AuditEventOut']
export type AuditListQuery = QueryOf<'list_audit_events_api_v1_audit_get'>
