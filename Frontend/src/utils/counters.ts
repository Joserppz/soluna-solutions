/**
 * Las insignias del menú («Donaciones 5», «Solicitudes 4») se cargan al entrar al
 * espacio del equipo. Una pantalla que cambia un pendiente (confirmar un aporte, por
 * ejemplo) avisa con refreshTeamCounters() y el menú las vuelve a pedir.
 */
export const COUNTERS_EVENT = 'aspar:contadores'

export function refreshTeamCounters() {
  window.dispatchEvent(new Event(COUNTERS_EVENT))
}
