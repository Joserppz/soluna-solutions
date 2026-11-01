/**
 * Última dirección del listado de afiliados (pestaña, búsqueda, filtros y página): la
 * ficha vuelve ahí con «‹ Afiliados». Si se entró directo a la ficha, va al listado.
 */
let last: string | null = null

export function rememberPatientsList(fullPath: string): void {
  last = fullPath
}

export function patientsListLocation(): string {
  return last ?? '/equipo/afiliados'
}

/** Para empezar de cero (pruebas). */
export function forgetPatientsList(): void {
  last = null
}
