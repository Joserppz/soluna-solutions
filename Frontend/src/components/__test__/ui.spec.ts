import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import DataTable from '../ui/DataTable.vue'
import FormField from '../ui/FormField.vue'
import PasswordInput from '../ui/PasswordInput.vue'
import SkeletonBlock from '../ui/SkeletonBlock.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import PasswordChecklist from '../auth/PasswordChecklist.vue'
import SessionTimeoutDialog from '../session/SessionTimeoutDialog.vue'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('Botón', () => {
  it('mientras carga queda deshabilitado y lo anuncia', () => {
    const wrapper = mount(AppButton, {
      props: { loading: true, loadingLabel: 'Guardando…' },
      slots: { default: 'Guardar' },
    })
    const button = wrapper.get('button')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.btn__spinner').exists()).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toBe('Guardando…')
  })

  it('puede ser un enlace del router o un enlace externo', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'inicio', component: { render: () => null } },
      ],
    })
    await router.push('/')
    const link = mount(AppButton, {
      props: { to: { name: 'inicio' }, variant: 'secondary' },
      slots: { default: 'Inicio' },
      global: { plugins: [router] },
    })
    const external = mount(AppButton, {
      props: { href: 'https://aspar.org' },
      slots: { default: 'Sitio' },
    })

    expect(link.get('a').attributes('href')).toBe('/')
    expect(link.get('a').classes()).toContain('btn--secondary')
    expect(external.get('a').attributes('href')).toBe('https://aspar.org')
  })
})

describe('Modal', () => {
  function host(dismissible = true) {
    return defineComponent({
      setup() {
        const open = ref(false)
        return () => [
          h(
            'button',
            { id: 'abrir', onClick: () => (open.value = true) },
            'Abrir',
          ),
          h(
            AppModal,
            {
              open: open.value,
              'onUpdate:open': (value: boolean) => (open.value = value),
              title: 'Confirmar',
              description: 'Revisa antes de seguir.',
              dismissible,
            },
            {
              default: () => h('p', 'Contenido'),
              actions: () => [
                h('button', { id: 'primero' }, 'Cancelar'),
                h('button', { id: 'ultimo' }, 'Aceptar'),
              ],
            },
          ),
        ]
      },
    })
  }

  it('es un diálogo accesible que toma el foco y lo devuelve al cerrarse', async () => {
    const wrapper = mount(host(), { attachTo: document.body })
    const opener = wrapper.get('#abrir')
    ;(opener.element as HTMLElement).focus()
    await opener.trigger('click')
    await flushPromises()

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(
      document.getElementById(dialog.getAttribute('aria-labelledby')!)
        ?.textContent,
    ).toBe('Confirmar')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
    expect(document.body.style.overflow).toBe('hidden')

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await flushPromises()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener.element)
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('mantiene el foco dentro con Tab y Mayús+Tab', async () => {
    const wrapper = mount(host(), { attachTo: document.body })
    await wrapper.get('#abrir').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    const last = document.getElementById('ultimo')!
    const first = dialog.querySelector('button')!

    last.focus()
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    expect(document.activeElement).toBe(first)

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      }),
    )
    expect(document.activeElement).toBe(last)
    wrapper.unmount()
  })

  it('una decisión importante no se cierra con Escape ni fuera del modal', async () => {
    const wrapper = mount(host(false), { attachTo: document.body })
    await wrapper.get('#abrir').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    document
      .querySelector('.modal-backdrop')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await nextTick()

    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(dialog.querySelector('[aria-label="Cerrar"]')).toBeNull()
    wrapper.unmount()
  })

  it('un clic fuera cierra el modal si se puede descartar', async () => {
    const wrapper = mount(host(), { attachTo: document.body })
    await wrapper.get('#abrir').trigger('click')
    await flushPromises()

    document
      .querySelector('.modal-backdrop')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})

describe('Campos de formulario', () => {
  it('une etiqueta, ayuda y error con el control', async () => {
    const wrapper = mount(FormField, {
      props: { label: 'Correo', hint: 'El de la asociación', required: true },
      slots: {
        default: `<template #default="field">
          <input :id="field.id" :aria-describedby="field.describedBy" :aria-invalid="field.invalid" />
        </template>`,
      },
    })
    const input = wrapper.get('input')

    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get(`#${input.attributes('aria-describedby')}`).text()).toBe(
      'El de la asociación',
    )
    expect(wrapper.get('.field__required').text()).toBe('*')

    await wrapper.setProps({ error: 'Revisa el correo' })
    expect(wrapper.get('.field__error').text()).toBe('Revisa el correo')
    expect(wrapper.find('.field__hint').exists()).toBe(false)
    expect(input.attributes('aria-invalid')).toBe('true')
  })

  it('la contraseña se puede mostrar y ocultar', async () => {
    const wrapper = mount(PasswordInput, {
      props: { id: 'clave', modelValue: 'Secreta1' },
    })
    const toggle = wrapper.get('button')

    expect(wrapper.get('input').attributes('type')).toBe('password')
    expect(toggle.attributes('aria-pressed')).toBe('false')

    await toggle.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(toggle.text()).toBe('Ocultar')
    expect(toggle.attributes('aria-label')).toBe('Ocultar contraseña')

    await wrapper.get('input').setValue('Otra2')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Otra2'])
    await wrapper.get('input').trigger('blur')
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('marca cada regla de la contraseña mientras se escribe', async () => {
    const wrapper = mount(PasswordChecklist, { props: { password: '' } })
    expect(wrapper.findAll('.is-ok')).toHaveLength(0)

    await wrapper.setProps({ password: 'Ceibo4821' })
    expect(wrapper.findAll('.is-ok')).toHaveLength(3)
    expect(wrapper.text()).toContain('(cumplido)')
  })
})

describe('Tabla', () => {
  const columns = [
    { key: 'name', label: 'Persona' },
    { key: 'role', label: 'Rol' },
    {
      key: 'actions',
      label: 'Acciones',
      hideLabel: true,
      align: 'end' as const,
    },
  ]
  const rows = [
    { id: 1, name: 'Lucía Choque', role: 'Administración' },
    { id: 2, name: 'René Vargas', role: 'Coordinación' },
  ]

  it('muestra las filas con celdas personalizadas', () => {
    const wrapper = mount(DataTable<(typeof rows)[number]>, {
      props: { columns, rows, rowKey: (row) => row.id, caption: 'Equipo' },
      slots: {
        'cell-actions':
          '<template #cell-actions="{ row }">Gestionar {{ row.id }}</template>',
      },
    })
    const cells = wrapper.findAll('tbody tr')[1]!.findAll('td')

    expect(wrapper.get('caption').text()).toBe('Equipo')
    expect(cells.map((td) => td.text())).toEqual([
      'René Vargas',
      'Coordinación',
      'Gestionar 2',
    ])
    expect(cells[0]!.attributes('data-label')).toBe('Persona')
    expect(cells[2]!.classes()).toContain('align-end')
  })

  it('muestra esqueletos mientras carga y un mensaje si no hay filas', async () => {
    const wrapper = mount(DataTable<(typeof rows)[number]>, {
      props: {
        columns,
        rows: [],
        rowKey: (row) => row.id,
        caption: 'Equipo',
        loading: true,
        skeletonRows: 3,
      },
      slots: { empty: 'Todavía no hay personas.' },
    })

    expect(wrapper.get('table').attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('tr.is-skeleton')).toHaveLength(3)

    await wrapper.setProps({ loading: false })
    expect(wrapper.get('.table__empty').text()).toBe('Todavía no hay personas.')
  })
})

describe('Avisos, insignias y esqueletos', () => {
  it('un error se anuncia de inmediato; un aviso, con calma', () => {
    const error = mount(AppAlert, {
      props: { tone: 'error', title: 'No se pudo guardar' },
      slots: { default: 'Revisa tu conexión.' },
    })
    const info = mount(AppAlert, { slots: { default: 'Guardado.' } })

    expect(error.attributes('role')).toBe('alert')
    expect(error.get('.alert__title').text()).toBe('No se pudo guardar')
    expect(info.attributes('role')).toBe('status')
  })

  it('las insignias usan el tono indicado', () => {
    const badge = mount(StatusBadge, {
      props: { tone: 'success' },
      slots: { default: 'Publicada' },
    })
    const plain = mount(StatusBadge, {
      props: { dot: false },
      slots: { default: 'Borrador' },
    })

    expect(badge.classes()).toContain('badge--success')
    expect(badge.find('.badge__dot').exists()).toBe(true)
    expect(plain.find('.badge__dot').exists()).toBe(false)
  })

  it('el esqueleto acorta la última línea de un párrafo', () => {
    const wrapper = mount(SkeletonBlock, { props: { lines: 3 } })
    const lines = wrapper.findAll('.skeleton')

    expect(lines).toHaveLength(3)
    expect(lines[2]!.attributes('style')).toContain('width: 62%')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})

describe('Aviso de inactividad', () => {
  it('muestra la cuenta regresiva y deja elegir', async () => {
    let release!: () => void
    const keepAlive = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const wrapper = mount(SessionTimeoutDialog, {
      attachTo: document.body,
      props: { open: true, remainingMs: 105_000, idleMinutes: 15, keepAlive },
    })
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement

    expect(dialog.querySelector('[role="timer"]')!.textContent).toBe('1:45')
    expect(dialog.textContent).toContain('tras 15 minutos sin uso')
    expect(dialog.querySelector('[aria-label="Cerrar"]')).toBeNull()

    const [logout, keep] = Array.from(
      dialog.querySelectorAll('.modal__actions button'),
    )
    ;(keep as HTMLButtonElement).click()
    await flushPromises()
    expect(keepAlive).toHaveBeenCalledOnce()
    expect(keep!.getAttribute('aria-busy')).toBe('true')
    release()
    await flushPromises()
    expect(keep!.getAttribute('aria-busy')).toBeNull()

    ;(logout as HTMLButtonElement).click()
    expect(wrapper.emitted('logout')).toHaveLength(1)
    wrapper.unmount()
  })
})
