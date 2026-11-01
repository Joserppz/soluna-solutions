<script setup lang="ts" generic="Key extends string">
/**
 * Pestañas accesibles (patrón «tabs» de WAI-ARIA): flechas, Inicio y Fin cambian de
 * pestaña. El panel lo pone la vista, con el id que devuelve panelId.
 */
import { nextTick, ref } from 'vue'

export interface TabItem<K extends string = string> {
  key: K
  label: string
  /** Número junto al título (contadores del listado). */
  count?: number | null
}

const props = defineProps<{
  items: TabItem<Key>[]
  modelValue: Key
  /** Nombre del grupo de pestañas para lectores de pantalla. */
  label: string
  /** Prefijo único para los id de pestañas y panel. */
  idPrefix: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Key] }>()
const list = ref<HTMLElement | null>(null)

function select(key: Key) {
  if (key !== props.modelValue) emit('update:modelValue', key)
}

async function move(event: KeyboardEvent) {
  const keys = props.items.map((item) => item.key)
  const index = keys.indexOf(props.modelValue)
  const target = {
    ArrowRight: keys[(index + 1) % keys.length],
    ArrowLeft: keys[(index - 1 + keys.length) % keys.length],
    Home: keys[0],
    End: keys[keys.length - 1],
  }[event.key]
  if (target === undefined) return
  event.preventDefault()
  select(target)
  await nextTick()
  list.value
    ?.querySelector<HTMLElement>(`#${props.idPrefix}-tab-${target}`)
    ?.focus()
}
</script>

<template>
  <div
    ref="list"
    class="tabs"
    role="tablist"
    :aria-label="label"
    @keydown="move"
  >
    <button
      v-for="item in items"
      :id="`${idPrefix}-tab-${item.key}`"
      :key="item.key"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'is-active': item.key === modelValue }"
      :aria-selected="item.key === modelValue"
      :aria-controls="`${idPrefix}-panel`"
      :tabindex="item.key === modelValue ? 0 : -1"
      @click="select(item.key)"
    >
      {{ item.label }}
      <span
        v-if="item.count !== undefined && item.count !== null"
        class="tabs__count"
      >
        {{ item.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs__tab {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.9rem;
  padding: 0 var(--space-4);
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.tabs__tab::after {
  content: '';
  position: absolute;
  inset: auto 0 -1px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background-color var(--duration-base) var(--ease-out);
}

.tabs__tab:hover {
  color: var(--color-text);
}

.tabs__tab.is-active {
  color: var(--aspar-guindo);
}

.tabs__tab.is-active::after {
  background: var(--aspar-guindo);
}

.tabs__tab:focus-visible {
  border-radius: var(--radius-sm);
  box-shadow: inset var(--focus-ring);
}

.tabs__count {
  min-width: 1.6rem;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--tone-neutral-bg);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.tabs__tab.is-active .tabs__count {
  background: var(--rosa-100);
  color: var(--aspar-guindo);
}
</style>
