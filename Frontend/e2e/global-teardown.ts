/**
 * Al terminar, borra lo que crearon los recorridos: las actividades, los materiales,
 * los aportes, los álbumes, las solicitudes y los afiliados «… de prueba 123456», y los
 * afiliados de prueba con nombre fijo de F2 y F4. Así no quedan mezclados con los datos
 * de demostración (el resumen, la agenda, la asistencia y las donaciones se ven como en
 * uso real).
 *
 * La API no borra una actividad publicada ni un aporte (se cancelan o anulan con un
 * motivo), así que se borra directo en la base de Docker. Si Docker no está a mano,
 * solo avisa. Con E2E_LIMPIAR=0 no borra nada.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const TEST_TITLE = String.raw`de prueba [0-9]{6}$`
/** Los afiliados de prueba de F2 y F4, con nombre fijo (cada recorrido los vuelve a crear). */
const FIXED_PATIENTS = String.raw`^(Hortensia Prueba Ficha|Ramiro Prueba (Pantalla|Encabezado)|Teresa Prueba Alta|Marina Asistencia Prueba|Prueba Paginación [0-9]{2})$`

const CLEANUP = `
begin;
create temp table e2e_schedules on commit drop as
  select id from schedules where title ~ '${TEST_TITLE}';
create temp table e2e_items on commit drop as
  select id from inventory_items where name ~ '${TEST_TITLE}';
delete from donations
  where donor_name ~ '${TEST_TITLE}' or in_kind_description ~ '${TEST_TITLE}';
delete from media_patient_tags where asset_id in (
  select m.id from media_assets m join media_albums a on a.id = m.album_id
  where a.title ~ '${TEST_TITLE}');
delete from media_assets where album_id in (
  select id from media_albums where title ~ '${TEST_TITLE}');
delete from media_albums where title ~ '${TEST_TITLE}';
create temp table e2e_patients on commit drop as
  select id from patients
  where name ~ '${TEST_TITLE}' or name ~ '${FIXED_PATIENTS}';
delete from media_patient_tags where patient_id in (select id from e2e_patients);
delete from attendance where patient_id in (select id from e2e_patients);
delete from patient_documents where patient_id in (select id from e2e_patients);
update inquiries set patient_id = null where patient_id in (select id from e2e_patients);
delete from patients where id in (select id from e2e_patients);
delete from inquiry_notes where inquiry_id in (
  select id from inquiries
  where name ~ '${TEST_TITLE}' or name ~ '${FIXED_PATIENTS}');
delete from inquiries
  where name ~ '${TEST_TITLE}' or name ~ '${FIXED_PATIENTS}';
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
