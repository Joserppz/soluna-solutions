<script setup lang="ts">
import { computed } from 'vue'

import { pageItems, rangeLabel } from '../../utils/pagination'

const props = defineProps<{
  total: number
  limit: number
  offset: number
  /** Filas que llegaron en esta página. */
  count: number
  /** Qué se pagina, para el nombre de la navegación («Páginas de afiliados»). */
  label: string
}>()

const emit = defineEmits<{ change: [offset: number] }>()

const current = computed(() => Math.floor(props.offset / props.limit) + 1)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / props.limit)),
)
const items = computed(() => pageItems(current.value, totalPages.value))

function go(page: number) {
  if (page < 1 || page > totalPages.value || page === current.value) return
  emit('change', (page - 1) * props.limit)
}
</script>

<template>
  <div class="pagination">
    <p class="pagination__range" aria-live="polite">
      {{ rangeLabel(offset, count, total) }}
    </p>
    <nav v-if="totalPages > 1" :aria-label="label">
      <ul class="pagination__pages">
        <li>
          <button
            type="button"
            class="page"
            aria-label="Página anterior"
            :disabled="current === 1"
            @click="go(current - 1)"
          >
            ‹
          </button>
        </li>
        <li v-for="(item, index) in items" :key="`${item}-${index}`">
          <span v-if="item === 'gap'" class="page page--gap" aria-hidden="true">
            …
          </span>
          <button
            v-else
            type="button"
            class="page"
            :class="{ 'is-current': item === current }"
            :aria-current="item === current ? 'page' : undefined"
            :aria-label="`Página ${item}`"
            @click="go(item)"
          >
            {{ item }}
          </button>
        </li>
        <li>
          <button
            type="button"
            class="page"
            aria-label="Página siguiente"
            :disabled="current === totalPages"
            @click="go(current + 1)"
          >
            ›
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-6);
}

.pagination__range {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.pagination__pages {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.page {
  display: grid;
  place-items: center;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.page:hover:not(:disabled, .is-current, .page--gap) {
  border-color: var(--aspar-verde);
}

.page:focus-visible {
  box-shadow: var(--focus-ring);
}

.page:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.page.is-current {
  border-color: var(--aspar-verde);
  background: var(--aspar-verde);
  color: #fff;
  cursor: default;
}

.page--gap {
  border-color: transparent;
  background: transparent;
  color: var(--color-text-muted);
  cursor: default;
}

/* Celular: los botones de página caben en una sola fila */
@media (max-width: 480px) {
  .pagination__pages {
    flex-wrap: nowrap;
    gap: var(--space-1);
  }

  .page {
    min-width: 2.25rem;
    height: 2.25rem;
    padding: 0 var(--space-1);
  }
}
</style>
