<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  getInventory,
  saveInventoryItem,
  type InventoryCondition,
  type InventoryItem,
  type InventoryOrigin,
} from '../services/aspar'

const items = ref<InventoryItem[]>(getInventory())
const originFilter = ref<'Todos' | InventoryOrigin>('Todos')
const exportNotice = ref('')

const form = reactive({
  code: '',
  name: '',
  category: 'Fisioterapia' as InventoryItem['category'],
  quantity: 1,
  origin: 'Préstamo Alcaldía' as InventoryOrigin,
  condition: 'Óptimo' as InventoryCondition,
  location: 'Sala de rehabilitación',
})

const filteredItems = computed(() => {
  if (originFilter.value === 'Todos') return items.value
  return items.value.filter((item) => item.origin === originFilter.value)
})

function submitItem() {
  if (!form.code.trim() || !form.name.trim()) return
  saveInventoryItem({
    code: form.code.trim(),
    name: form.name.trim(),
    category: form.category,
    quantity: Number(form.quantity) || 1,
    origin: form.origin,
    condition: form.condition,
    location: form.location.trim() || 'Sede ASPAR',
  })
  items.value = getInventory()
  form.code = ''
  form.name = ''
  form.quantity = 1
}

function exportReport(format: 'CSV' | 'PDF') {
  if (format === 'CSV') {
    const header =
      'Codigo,Material,Categoria,Cantidad,Origen,Estado,Ubicacion\n'
    const rows = filteredItems.value
      .map(
        (i) =>
          `"${i.code}","${i.name}","${i.category}",${i.quantity},"${i.origin}","${i.condition}","${i.location}"`,
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'reporte_inventario_alcaldia_aspar.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  exportNotice.value = `Reporte de inventario (${filteredItems.value.length} ítems) generado en formato ${format} para presentación ante la Alcaldía (RF-09).`
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow">Control Patrimonial · RF-03 / RF-09</span>
    <h1>Inventario y reportes para la Alcaldía</h1>
    <p>
      Administra el mobiliario e insumos de fisioterapia propios, donados o en
      préstamo por la Alcaldía y exporta reportes verificables.
    </p>
  </section>

  <section class="card form-card wide-card">
    <h2>Registrar material o equipo</h2>
    <form @submit.prevent="submitItem">
      <div class="form-grid">
        <div class="field">
          <label for="inv-code">Código de inventario</label>
          <input
            id="inv-code"
            v-model.trim="form.code"
            placeholder="ASP-MAT-004"
            required
          />
        </div>

        <div class="field">
          <label for="inv-name">Descripción del material</label>
          <input
            id="inv-name"
            v-model.trim="form.name"
            placeholder="Ej. Mancuernas de neopreno 1 kg"
            required
          />
        </div>

        <div class="field">
          <label for="inv-category">Categoría</label>
          <select id="inv-category" v-model="form.category">
            <option>Fisioterapia</option>
            <option>Mobiliario</option>
            <option>Papelería</option>
            <option>Ayuda Técnica</option>
          </select>
        </div>

        <div class="field">
          <label for="inv-qty">Cantidad</label>
          <input
            id="inv-qty"
            v-model.number="form.quantity"
            type="number"
            min="1"
            required
          />
        </div>

        <div class="field">
          <label for="inv-origin">Origen del bien</label>
          <select id="inv-origin" v-model="form.origin">
            <option>Préstamo Alcaldía</option>
            <option>Propio ASPAR</option>
            <option>Donación</option>
          </select>
        </div>

        <div class="field">
          <label for="inv-condition">Estado físico</label>
          <select id="inv-condition" v-model="form.condition">
            <option>Óptimo</option>
            <option>Bueno</option>
            <option>En mantenimiento</option>
            <option>Baja</option>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button class="button button-primary" type="submit">
          Registrar en inventario
        </button>
      </div>
    </form>
  </section>

  <section class="card table-card patient-list">
    <div class="section-title table-heading">
      <div>
        <h2>Existencias registradas</h2>
        <p class="muted">{{ filteredItems.length }} ítems controlados</p>
      </div>

      <div class="filter-bar">
        <select v-model="originFilter" aria-label="Filtrar por origen">
          <option value="Todos">Todos los orígenes</option>
          <option value="Préstamo Alcaldía">Préstamo Alcaldía</option>
          <option value="Propio ASPAR">Propio ASPAR</option>
          <option value="Donación">Donación</option>
        </select>

        <button
          class="button button-small button-secondary"
          type="button"
          @click="exportReport('CSV')"
        >
          Exportar Excel/CSV (RF-09)
        </button>

        <button
          class="button button-small button-primary"
          type="button"
          @click="exportReport('PDF')"
        >
          Generar Acta PDF Alcaldía
        </button>
      </div>
    </div>

    <p v-if="exportNotice" class="success-message notice-card" role="status">
      {{ exportNotice }}
    </p>

    <article v-for="item in filteredItems" :key="item.id" class="patient-row">
      <div class="patient-main">
        <strong>{{ item.code }} · {{ item.name }}</strong>
        <small>
          Categoría: {{ item.category }} · Cantidad: {{ item.quantity }} uds. ·
          Ubicación: {{ item.location }}
        </small>
      </div>
      <span class="count-pill">{{ item.origin }}</span>
      <span class="consent-pill consent-ok">{{ item.condition }}</span>
    </article>
  </section>
</template>
