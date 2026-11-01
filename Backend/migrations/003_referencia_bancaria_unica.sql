-- =============================================================================
-- ASPAR — Migración 003: una referencia del extracto confirma un solo aporte
--
-- El servicio ya revisa que la referencia no se haya usado, pero dos personas que
-- confirman a la vez dos avisos distintos con la misma referencia pasan las dos esa
-- revisión: el mismo depósito sumaría dos veces a la meta. Este índice hace que la
-- base rechace la segunda confirmación (la API responde 409).
--
-- Solo cuenta lo confirmado: un aviso anulado o pendiente no reserva la referencia.
-- Sin distinguir mayúsculas («ext-0193» y «EXT-0193» son la misma).
-- =============================================================================

create unique index donations_referencia_extracto_unica
  on public.donations (lower(bank_reference))
  where status = 'confirmado' and bank_reference is not null;
