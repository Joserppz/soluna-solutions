import { describe, expect, it } from 'vitest'

import { HttpClient } from '../client'
import { createEndpoints } from '../endpoints'
import { call, fakeFetch } from './fakeFetch'

const BASE = 'https://api.aspar.test/api/v1'

function setup() {
  const fetchMock = fakeFetch()
  const api = createEndpoints(
    new HttpClient({ baseUrl: BASE, fetch: fetchMock }),
  )
  return { api, fetchMock }
}

describe('Endpoints', () => {
  it('cada método llama a la ruta y el verbo del contrato', async () => {
    const { api, fetchMock } = setup()
    const requests: [() => Promise<unknown>, string, string][] = [
      [() => api.auth.me(), 'GET', '/auth/me'],
      [() => api.auth.refresh(), 'POST', '/auth/refresh'],
      [() => api.auth.logout(), 'POST', '/auth/logout'],
      [
        () =>
          api.auth.register({
            name: 'Rosa',
            email: 'r@gmail.com',
            password: 'x',
            turnstileToken: 't',
          }),
        'POST',
        '/auth/register',
      ],
      [
        () => api.auth.verifyEmail({ token: 't' }),
        'POST',
        '/auth/verify-email',
      ],
      [
        () =>
          api.auth.resendVerification({
            email: 'r@gmail.com',
            turnstileToken: 't',
          }),
        'POST',
        '/auth/resend-verification',
      ],
      [
        () =>
          api.auth.forgotPassword({
            email: 'r@gmail.com',
            turnstileToken: 't',
          }),
        'POST',
        '/auth/forgot-password',
      ],
      [
        () => api.auth.resetPassword({ token: 't', password: 'x' }),
        'POST',
        '/auth/reset-password',
      ],
      [
        () => api.patients.list({ search: 'rojas', limit: 20 }),
        'GET',
        '/patients?search=rojas&limit=20',
      ],
      [() => api.patients.get('p 1'), 'GET', '/patients/p%201'],
      [
        () => api.patients.update('p1', { phone: '70000000' }),
        'PATCH',
        '/patients/p1',
      ],
      [
        () => api.patients.deactivate('p1', { reason: 'Se mudó' }),
        'POST',
        '/patients/p1/deactivate',
      ],
      [() => api.patients.reactivate('p1'), 'POST', '/patients/p1/reactivate'],
      [() => api.documents.list('p1'), 'GET', '/patients/p1/documents'],
      [() => api.contacts.list('p1'), 'GET', '/patients/p1/contacts'],
      [
        () =>
          api.contacts.add('p1', {
            name: 'Rosa',
            relation: 'Hija',
            phone: '76559012',
          }),
        'POST',
        '/patients/p1/contacts',
      ],
      [
        () => api.contacts.update('p1', 'c1', { isPrimary: true }),
        'PATCH',
        '/patients/p1/contacts/c1',
      ],
      [
        () => api.contacts.remove('p1', 'c1'),
        'DELETE',
        '/patients/p1/contacts/c1',
      ],
      [
        () => api.evaluations.list('p1', 'fisica'),
        'GET',
        '/patients/p1/evaluations?area=fisica',
      ],
      [
        () => api.evaluations.get('p1', 'e1'),
        'GET',
        '/patients/p1/evaluations/e1',
      ],
      [
        () =>
          api.evaluations.create('p1', {
            area: 'fisica',
            evaluatedOn: '2026-10-14',
            notes: 'Mejor equilibrio.',
          }),
        'POST',
        '/patients/p1/evaluations',
      ],
      [
        () => api.evaluations.update('p1', 'e1', { notes: 'Corregido.' }),
        'PATCH',
        '/patients/p1/evaluations/e1',
      ],
      [
        () => api.documents.signedUrl('p1', 'd1'),
        'GET',
        '/patients/p1/documents/d1/url',
      ],
      [
        () => api.documents.remove('p1', 'd1'),
        'DELETE',
        '/patients/p1/documents/d1',
      ],
      [() => api.users.list({ search: 'ana' }), 'GET', '/users?search=ana'],
      [
        () =>
          api.users.create({
            name: 'Ana',
            email: 'ana@aspar.org',
            role: 'volunteer',
          }),
        'POST',
        '/users',
      ],
      [() => api.users.update('u1', { active: false }), 'PATCH', '/users/u1'],
      [() => api.users.resetPassword('u1'), 'POST', '/users/u1/reset-password'],
      [
        () => api.users.list({ role: 'pendiente' }),
        'GET',
        '/users?role=pendiente',
      ],
      [
        () => api.users.approve('u1', { role: 'reception' }),
        'POST',
        '/users/u1/approve',
      ],
      [() => api.roles.matrix(), 'GET', '/roles'],
      [
        () => api.schedules.list({ status: 'borrador' }),
        'GET',
        '/schedules?status=borrador',
      ],
      [() => api.schedules.get('s1'), 'GET', '/schedules/s1'],
      [
        () =>
          api.schedules.create({
            title: 'Movimiento en compañía',
            category: 'fisioterapia',
            date: '2026-11-07',
            startTime: '10:00',
            endTime: '11:30',
            location: 'Sede ASPAR',
          }),
        'POST',
        '/schedules',
      ],
      [
        () => api.schedules.update('s1', { spots: 30 }),
        'PATCH',
        '/schedules/s1',
      ],
      [() => api.schedules.publish('s1'), 'POST', '/schedules/s1/publish'],
      [() => api.schedules.unpublish('s1'), 'POST', '/schedules/s1/unpublish'],
      [
        () => api.schedules.cancel('s1', { note: 'Se reprograma' }),
        'POST',
        '/schedules/s1/cancel',
      ],
      [() => api.schedules.remove('s1'), 'DELETE', '/schedules/s1'],
      [
        () => api.attendance.sheet('s1', 'alba'),
        'GET',
        '/schedules/s1/attendance?search=alba',
      ],
      [
        () =>
          api.attendance.mark('s1', 'p1', {
            status: 'vino',
            note: 'Con su hija',
          }),
        'PUT',
        '/schedules/s1/attendance/p1',
      ],
      [
        () => api.attendance.markAllPresent('s1'),
        'POST',
        '/schedules/s1/attendance/mark-all-present',
      ],
      [
        () => api.attendance.close('s1'),
        'POST',
        '/schedules/s1/attendance/close',
      ],
      [
        () => api.attendance.reopen('s1'),
        'POST',
        '/schedules/s1/attendance/reopen',
      ],
      [
        () =>
          api.attendance.addNewcomer('s1', {
            name: 'Elena Quisbert',
            phone: '71234567',
          }),
        'POST',
        '/schedules/s1/attendance/newcomers',
      ],
      [
        () => api.attendance.monthly('2026-10'),
        'GET',
        '/attendance/monthly?month=2026-10',
      ],
      [
        () => api.public.schedules({ from: '2026-11-01' }),
        'GET',
        '/public/schedules?from=2026-11-01',
      ],
      [
        () =>
          api.roles.updatePermissions('volunteer', {
            permissions: ['attendance:write', 'patients:read'],
            confirmSensitive: false,
          }),
        'PUT',
        '/roles/volunteer/permissions',
      ],
      [
        () => api.audit.list({ severity: 'CRITICAL', from: '2026-10-01' }),
        'GET',
        '/audit?severity=CRITICAL&from=2026-10-01',
      ],
    ]

    for (const [index, [send, method, path]] of requests.entries()) {
      await send()
      expect(call(fetchMock, index).init.method, path).toBe(method)
      expect(call(fetchMock, index).url).toBe(`${BASE}${path}`)
    }
  })

  it('descarga el resumen mensual como archivo', async () => {
    const fetchMock = fakeFetch({ body: 'Fecha;Actividad' })
    const api = createEndpoints(
      new HttpClient({ baseUrl: BASE, fetch: fetchMock }),
    )

    const file = await api.attendance.downloadMonthly('csv', '2026-10')

    expect(call(fetchMock).url).toBe(
      `${BASE}/attendance/monthly?month=2026-10&format=csv`,
    )
    // En las pruebas el Blob de fetch (Node) y el global (jsdom) son de clases distintas
    expect(file.size).toBe(15)
    expect(await file.text()).toBe('Fecha;Actividad')
  })

  it('sube documentos como multipart con su tipo', async () => {
    const { api, fetchMock } = setup()
    const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' })

    await api.documents.upload(
      'p1',
      'Consentimiento',
      file,
      'consentimiento.pdf',
    )

    const body = call(fetchMock).init.body as FormData
    expect(body.get('documentType')).toBe('Consentimiento')
    expect((body.get('file') as File).name).toBe('consentimiento.pdf')
  })
})
