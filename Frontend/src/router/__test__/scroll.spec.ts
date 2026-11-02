import { describe, expect, it } from 'vitest'
import { createMemoryHistory, type RouteLocationNormalized } from 'vue-router'

import { createAppRouter } from '..'

function at(path: string, hash = ''): RouteLocationNormalized {
  return { path, hash } as RouteLocationNormalized
}

describe('Desplazamiento al navegar', () => {
  const behavior = createAppRouter(undefined, createMemoryHistory()).options
    .scrollBehavior!

  it('otra pantalla empieza arriba y «Atrás» vuelve a donde estaba', async () => {
    expect(
      await behavior(at('/equipo/afiliados/1'), at('/equipo/afiliados'), null),
    ).toEqual({ top: 0 })
    expect(
      await behavior(at('/equipo'), at('/equipo/afiliados'), {
        left: 0,
        top: 420,
      }),
    ).toEqual({ left: 0, top: 420 })
    expect(await behavior(at('/', '#donar'), at('/equipo'), null)).toEqual({
      el: '#donar',
      behavior: 'smooth',
    })
  })

  it('cambiar la pestaña, la búsqueda o la página de la misma pantalla no la mueve', async () => {
    expect(
      await behavior(at('/equipo/afiliados'), at('/equipo/afiliados'), null),
    ).toBe(false)
  })
})
