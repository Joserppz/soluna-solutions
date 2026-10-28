import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleManagementView from '../ScheduleManagementView.vue'
import ScheduleView from '../ScheduleView.vue'
import {
  getAuditEvents,
  getPublicSchedule,
  getSchedule,
  saveScheduleItem,
  signIn,
} from '../../services/aspar'

// SCRUM-16 / SCRUM-74: formulario administrativo del cronograma (RF-04, RF-10)
function inDays(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

async function fillActivity(
  wrapper: ReturnType<typeof mount>,
  title: string,
  date = inDays(7),
) {
  await wrapper.find('#sched-title').setValue(title)
  await wrapper.find('#sched-category').setValue('Psicología')
  await wrapper.find('#sched-date').setValue(date)
  await wrapper.find('#sched-time').setValue('11:00')
  await wrapper.find('#sched-professional').setValue('Lic. Paola Ríos')
  await wrapper.find('#sched-location').setValue('Consultorio 1')
  await wrapper.find('#sched-spots').setValue(10)
}

function row(wrapper: ReturnType<typeof mount>, title: string) {
  return wrapper
    .findAll('.schedule-admin-row')
    .find((item) => item.text().includes(title))!
}

function rowButton(
  wrapper: ReturnType<typeof mount>,
  title: string,
  label: string,
) {
  return row(wrapper, title)
    .findAll('button')
    .find((button) => button.text() === label)!
}

describe('SCRUM-74: gestión del cronograma de actividades', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    signIn('coordinacion@aspar.org', 'Coord2026!')
  })

  it('crea una actividad, la publica en el portal y queda en la bitácora', async () => {
    const wrapper = mount(ScheduleManagementView)

    await fillActivity(wrapper, 'Grupo de apoyo para cuidadores')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.success-message').text()).toContain(
      'publicada en el portal',
    )
    expect(row(wrapper, 'Grupo de apoyo para cuidadores').text()).toContain(
      'Publicada',
    )
    expect(
      getPublicSchedule().some(
        (a) => a.title === 'Grupo de apoyo para cuidadores',
      ),
    ).toBe(true)
    expect(getAuditEvents()[0]?.category).toBe('CRONOGRAMA')

    const portal = mount(ScheduleView)
    expect(portal.text()).toContain('Grupo de apoyo para cuidadores')
  })

  it('valida los datos antes de guardar', async () => {
    const wrapper = mount(ScheduleManagementView)

    await fillActivity(wrapper, 'Yo')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.form-error').text()).toContain(
      'al menos 3 caracteres',
    )

    await fillActivity(wrapper, 'Actividad pasada', inDays(-2))
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.form-error').text()).toContain('anterior a hoy')

    await fillActivity(wrapper, 'Actividad con cupos inválidos')
    await wrapper.find('#sched-spots').setValue(500)
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.form-error').text()).toContain('entre 0 y 200')
  })

  it('edita una actividad existente', async () => {
    const original = getSchedule()[0]!
    const wrapper = mount(ScheduleManagementView)

    await rowButton(wrapper, original.title, 'Editar').trigger('click')
    expect(wrapper.find('h2').text()).toBe('Editar actividad')
    await wrapper.find('#sched-time').setValue('15:30')
    await wrapper.find('form').trigger('submit.prevent')

    const updated = getSchedule().find((a) => a.id === original.id)!
    expect(updated.time).toBe('15:30')
    expect(getSchedule()).toHaveLength(3)
  })

  it('ocultar una actividad la quita del portal y publicarla la vuelve a mostrar', async () => {
    const target = getSchedule()[0]!
    const wrapper = mount(ScheduleManagementView)

    await rowButton(wrapper, target.title, 'Ocultar').trigger('click')
    expect(getPublicSchedule().some((a) => a.id === target.id)).toBe(false)
    expect(mount(ScheduleView).text()).not.toContain(target.title)

    await rowButton(wrapper, target.title, 'Publicar').trigger('click')
    expect(getPublicSchedule().some((a) => a.id === target.id)).toBe(true)
  })

  it('elimina una actividad solo después de confirmar', async () => {
    const target = getSchedule()[0]!
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    const wrapper = mount(ScheduleManagementView)

    await rowButton(wrapper, target.title, 'Eliminar').trigger('click')
    expect(getSchedule().some((a) => a.id === target.id)).toBe(true)

    confirm.mockReturnValueOnce(true)
    await rowButton(wrapper, target.title, 'Eliminar').trigger('click')
    expect(getSchedule().some((a) => a.id === target.id)).toBe(false)
  })

  it('un rol sin permiso no puede guardar actividades', () => {
    signIn('demo@aspar.org', 'Aspar2026!')

    expect(() =>
      saveScheduleItem({
        title: 'Actividad no autorizada',
        category: 'Bienestar',
        date: inDays(3),
        time: '10:00',
        professional: 'Lic. Ana Flores',
        location: 'Sede ASPAR',
        spots: 5,
        published: true,
      }),
    ).toThrow(/Administrador y el Coordinador/)
  })
})
