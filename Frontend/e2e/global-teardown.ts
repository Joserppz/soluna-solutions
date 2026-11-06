/**
 * Al terminar, borra lo que crearon los recorridos: las actividades, los materiales y
 * los aportes «… de prueba 123456». Así no quedan mezclados con los datos de
 * demostración (la agenda, la asistencia, el inventario y las donaciones se ven como en
 * uso real).
 *
 * La API no borra una actividad publicada ni un aporte (se cancelan o anulan con un
 * motivo), así que se borra directo en la base de Docker. Si Docker no está a mano,
 * solo avisa. Con E2E_LIMPIAR=0 no borra nada.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const TEST_TITLE = String.raw`de prueba [0-9]{6}$`

const CLEANUP = `
begin;
create temp table e2e_schedules on commit drop as
  select id from schedules where title ~ '${TEST_TITLE}';
create temp table e2e_items on commit drop as
  select id from inventory_items where name ~ '${TEST_TITLE}';
delete from donations
  where donor_name ~ '${TEST_TITLE}' or in_kind_description ~ '${TEST_TITLE}';
delete from attendance where schedule_id in (select id from e2e_schedules);
update inquiries set schedule_id = null where schedule_id in (select id from e2e_schedules);
update media_albums set schedule_id = null where schedule_id in (select id from e2e_schedules);
delete from schedules where id in (select id from e2e_schedules);
delete from inventory_movements where item_id in (select id from e2e_items);
update donations set inventory_item_id = null where inventory_item_id in (select id from e2e_items);
delete from inventory_items where id in (select id from e2e_items);
commit;
`

export default function globalTeardown() {
  if (process.env.E2E_LIMPIAR === '0') return
  const compose = fileURLToPath(
    new URL('../../docker-compose.yml', import.meta.url),
  )
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      compose,
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'aspar',
      '-d',
      'aspar',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      CLEANUP,
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0)
    console.warn(
      `No se pudieron borrar los datos de prueba de operación: ${result.stderr || result.error?.message || 'sin detalle'}`,
    )
}
