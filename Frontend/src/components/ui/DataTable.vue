<script setup lang="ts" generic="Row">
import SkeletonBlock from './SkeletonBlock.vue'

export interface Column {
  key: string
  label: string
  align?: 'start' | 'end' | 'center'
  /** Oculta el título de la columna (por ejemplo, la de acciones). */
  hideLabel?: boolean
}

withDefaults(
  defineProps<{
    columns: Column[]
    rows: Row[]
    rowKey: (row: Row) => string | number
    loading?: boolean
    /** Filas de esqueleto mientras carga. */
    skeletonRows?: number
    /**
     * Los títulos de las columnas quedan fijos al desplazar la página, justo debajo
     * del encabezado fijo de la vista (StickyHeader).
     */
    stickyHead?: boolean
    caption: string
  }>(),
  { loading: false, skeletonRows: 5, stickyHead: false },
)

function cellValue(row: Row, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

defineSlots<
  Record<`cell-${string}`, (props: { row: Row }) => unknown> & {
    empty?: () => unknown
  }
>()
</script>

<template>
  <div class="table-wrap" :class="{ 'table-wrap--sticky': stickyHead }">
    <table class="table" :aria-busy="loading || undefined">
      <caption class="visually-hidden">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="`align-${column.align ?? 'start'}`"
          >
            <span :class="{ 'visually-hidden': column.hideLabel }">
              {{ column.label }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="n in skeletonRows" :key="`s${n}`" class="is-skeleton">
          <td v-for="column in columns" :key="column.key">
            <SkeletonBlock
              height="0.9rem"
              :width="column.hideLabel ? '4rem' : '80%'"
            />
          </td>
        </tr>
      </tbody>
      <tbody v-else-if="rows.length">
        <tr v-for="row in rows" :key="rowKey(row)">
          <td
            v-for="column in columns"
            :key="column.key"
            :data-label="column.hideLabel ? undefined : column.label"
            :class="`align-${column.align ?? 'start'}`"
          >
            <slot :name="`cell-${column.key}`" :row="row">
              {{ cellValue(row, column.key) }}
            </slot>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr>
          <td :colspan="columns.length" class="table__empty">
            <slot name="empty">No hay nada para mostrar todavía.</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  width: 100%;
  overflow-x: auto;
  /* Las filas se vuelven tarjetas según el ancho de la tabla, no de la pantalla */
  container-type: inline-size;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-md);
}

th {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-strong);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  white-space: nowrap;
}

td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

/* Con títulos fijos la tabla no puede tener su propia zona de desplazamiento: «clip»
   recorta igual que «auto», pero deja que los títulos se peguen a la página */
.table-wrap--sticky {
  overflow-x: clip;
}

.table-wrap--sticky th {
  position: sticky;
  top: var(--sticky-header-bottom, var(--team-sticky-top, 0px));
  z-index: 1;
  background: var(--color-surface);
}

tbody tr {
  transition: background-color var(--duration-fast) var(--ease-out);
}

tbody tr:not(.is-skeleton):hover {
  background: rgb(7 57 48 / 0.025);
}

.align-end {
  text-align: right;
}

.align-center {
  text-align: center;
}

.table__empty {
  padding: var(--space-10) var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
}

/* Si la tabla no entra a lo ancho (celular, tableta o menú abierto), cada fila se
   vuelve una tarjeta: nunca aparece una barra de desplazamiento horizontal */
@container (max-width: 50rem) {
  .table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .table,
  .table tbody,
  .table tr,
  .table td {
    display: block;
    width: 100%;
  }

  .table tr {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .table td {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-1);
    border: 0;
    text-align: right;
  }

  .table td[data-label]::before {
    content: attr(data-label);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: 600;
    text-align: left;
  }

  .table__empty {
    justify-content: center !important;
  }
}
</style>
