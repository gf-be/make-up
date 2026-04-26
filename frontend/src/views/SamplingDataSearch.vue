<template>
  <div class="sampling-search" v-loading="loading">
    <el-card shadow="never" class="filter-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="page-title">抽检数据检索</div>
            <div class="page-subtitle">多维度组合检索、自定义列表与导出；条件之间为「且」，同维度多选为「或」。</div>
          </div>
          <div class="header-actions">
            <el-dropdown v-if="searchHistory.length" trigger="click" @command="applyHistory">
              <el-button>
                历史检索 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="h in searchHistory"
                    :key="h.id"
                    :command="h"
                  >
                    {{ h.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>

      <el-form :model="filters" label-width="100px" class="filter-form">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="起始年份">
              <el-select v-model="filters.year_start" clearable placeholder="不限" style="width: 100%">
                <el-option v-for="y in yearOptions" :key="'ys' + y" :label="y + '年'" :value="y" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="结束年份">
              <el-select v-model="filters.year_end" clearable placeholder="不限" style="width: 100%">
                <el-option v-for="y in yearOptions" :key="'ye' + y" :label="y + '年'" :value="y" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="省份">
              <el-select
                v-model="filters.provinces"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="全国31省区市，多选为或"
                style="width: 100%"
              >
                <el-option v-for="p in options.provinces" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="企业名称">
              <el-input v-model="filters.company_keyword" clearable placeholder="关键词模糊匹配" @keyup.enter="runSearch" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产品品类">
              <el-select
                v-model="filters.product_categories"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="多选为或"
                style="width: 100%"
              >
                <el-option v-for="c in options.product_categories" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="不合格项目">
              <el-select
                v-model="filters.issue_items"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="多选为或"
                style="width: 100%"
              >
                <el-option v-for="i in options.issue_items" :key="i.value" :label="i.label" :value="i.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="通告批次">
              <el-select
                v-model="filters.announcement_ids"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="随年份筛选加载；不选表示不限"
                style="width: 100%"
              >
                <el-option
                  v-for="a in options.announcements"
                  :key="a.value"
                  :label="a.label"
                  :value="a.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label=" ">
              <el-button type="primary" @click="runSearch">检索</el-button>
              <el-button @click="resetFilters">重置条件</el-button>
              <el-button @click="saveCurrentSearch">保存本次条件</el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-row :gutter="16" class="mt-16">
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>
            <span>可视化</span>
          </template>
          <div class="chart-row">
            <div ref="provinceChartRef" class="chart-box" />
            <div ref="issueChartRef" class="chart-box" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <span>表格与导出</span>
          </template>
          <div class="tool-actions">
            <el-input v-model="tableQuickFilter" clearable placeholder="当前页内快速过滤" style="width: 220px" />
            <el-button @click="columnDialogVisible = true">自定义列</el-button>
            <el-checkbox v-model="includeFilterSheet">导出含筛选说明页</el-checkbox>
            <el-checkbox v-model="maskSensitive">导出脱敏地址</el-checkbox>
          </div>
          <div class="export-actions">
            <el-button type="primary" plain size="small" @click="exportData('page', 'xlsx')">导出当前页 Excel</el-button>
            <el-button type="primary" plain size="small" @click="exportData('all', 'xlsx')">导出全部结果 Excel</el-button>
            <!-- <el-button size="small" @click="exportData('page', 'csv')">导出当前页 CSV</el-button>
            <el-button size="small" @click="exportData('all', 'csv')">导出全部 CSV</el-button> -->
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mt-16 table-card">
      <el-table
        :data="filteredTableRows"
        border
        stripe
        style="width: 100%"
        @sort-change="onSortChange"
      >
        <el-table-column
          v-for="key in orderedColumnKeys"
          :key="key"
          :prop="key"
          :label="displayLabel(key)"
          :min-width="colWidth(key)"
          sortable="custom"
          show-overflow-tooltip
        />
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          @size-change="runSearch"
          @current-change="runSearch"
        />
      </div>
    </el-card>

    <el-dialog v-model="columnDialogVisible" title="自定义表格列" width="720px" destroy-on-close>
      <el-tabs>
        <el-tab-pane label="字段与顺序">
          <p class="hint">勾选展示列，拖拽名称调整顺序；可在别名中修改导出列名。</p>
          <div v-for="group in fieldGroups" :key="group.group" class="field-group">
            <div class="group-title">{{ group.groupLabel }}</div>
            <el-checkbox-group v-model="selectedColumnKeys">
              <el-checkbox
                v-for="f in group.fields"
                :key="f.key"
                :label="f.key"
                class="field-cb"
              >
                {{ f.label }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="drag-list" v-if="orderedColumnKeys.length">
            <div class="drag-title">列顺序（拖拽调整）</div>
            <ul>
              <li
                v-for="(key, index) in orderedColumnKeys"
                :key="key"
                draggable="true"
                class="drag-item"
                @dragstart="onDragStart(index)"
                @dragover.prevent
                @drop="onDrop(index)"
              >
                {{ displayLabel(key) }}
                <span class="key-tag">{{ key }}</span>
              </li>
            </ul>
          </div>
        </el-tab-pane>
        <el-tab-pane label="字段别名">
          <el-form label-width="120px">
            <el-form-item v-for="key in orderedColumnKeys" :key="'al' + key" :label="displayLabel(key)">
              <el-input v-model="columnAliases[key]" clearable placeholder="默认使用中文列名" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="模板">
          <div class="template-row">
            <el-input v-model="newTemplateName" placeholder="新模板名称，如：企业问题汇总表" style="max-width: 280px" />
            <el-button type="primary" @click="saveTemplate">保存当前列为模板</el-button>
          </div>
          <el-table :data="columnTemplates" size="small" class="mt-8">
            <el-table-column prop="name" label="模板名" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button link type="primary" @click="applyTemplate(row)">套用</el-button>
                <el-button link type="danger" @click="removeTemplate(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="columnDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="columnDialogVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import {
  getSamplingSearchFieldSchema,
  getSamplingSearchOptions,
  postSamplingSearchQuery,
  postSamplingSearchExport
} from '@/api/index'

const loading = ref(false)
const exporting = ref(false)
const provinceChartRef = ref(null)
const issueChartRef = ref(null)
let provinceChart = null
let issueChart = null
let dragIndex = null

const yearOptions = []
for (let y = 2015; y <= 2035; y += 1) {
  yearOptions.push(y)
}

const filters = reactive({
  year_start: null,
  year_end: null,
  provinces: [],
  company_keyword: '',
  product_categories: [],
  issue_items: [],
  announcement_ids: []
})

const options = reactive({
  provinces: [],
  product_categories: [],
  issue_items: [],
  announcements: []
})

const tableRows = ref([])
const chartData = reactive({
  province_top10: [],
  issue_top10: []
})

const tableQuickFilter = ref('')
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const sortState = reactive({
  prop: 'source_publish_date',
  order: 'descending'
})

const fieldGroups = ref([])
const defaultColumns = ref([])
const orderedColumnKeys = ref([])
const selectedColumnKeys = ref([])
const columnAliases = reactive({})
const columnDialogVisible = ref(false)
const newTemplateName = ref('')

const HISTORY_KEY = 'sampling_search_history_v1'
const TEMPLATE_KEY = 'sampling_search_column_templates_v1'

const searchHistory = ref([])
const columnTemplates = ref([])

const includeFilterSheet = ref(true)
const maskSensitive = ref(true)

const fieldMetaMap = computed(() => {
  const map = {}
  fieldGroups.value.forEach((g) => {
    g.fields.forEach((f) => {
      map[f.key] = f
    })
  })
  return map
})

const filteredTableRows = computed(() => {
  const q = tableQuickFilter.value.trim().toLowerCase()
  if (!q) {
    return tableRows.value
  }
  return tableRows.value.filter((row) => {
    return Object.values(row).some((v) => {
      if (v === null || v === undefined) {
        return false
      }
      return String(v).toLowerCase().includes(q)
    })
  })
})

function displayLabel(key) {
  if (columnAliases[key]) {
    return columnAliases[key]
  }
  return fieldMetaMap.value[key]?.label || key
}

function colWidth(key) {
  if (['source_title', 'unqualified_items', 'company_names', 'remarks'].includes(key)) {
    return 200
  }
  if (['issue_items_display', 'product_categories_display'].includes(key)) {
    return 160
  }
  return 120
}

function syncOrderedKeys() {
  const selected = new Set(selectedColumnKeys.value)
  const next = []
  orderedColumnKeys.value.forEach((k) => {
    if (selected.has(k)) {
      next.push(k)
    }
  })
  selectedColumnKeys.value.forEach((k) => {
    if (!next.includes(k)) {
      next.push(k)
    }
  })
  orderedColumnKeys.value = next
}

watch(selectedColumnKeys, () => {
  syncOrderedKeys()
}, { deep: true })

function onDragStart(index) {
  dragIndex = index
}

function onDrop(index) {
  if (dragIndex === null || dragIndex === index) {
    return
  }
  const list = [...orderedColumnKeys.value]
  const [moved] = list.splice(dragIndex, 1)
  list.splice(index, 0, moved)
  orderedColumnKeys.value = list
  dragIndex = null
}

function loadLocalStorage() {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    searchHistory.value = Array.isArray(h) ? h : []
  } catch {
    searchHistory.value = []
  }
  try {
    const t = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]')
    columnTemplates.value = Array.isArray(t) ? t : []
  } catch {
    columnTemplates.value = []
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value.slice(0, 20)))
}

function persistTemplates() {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(columnTemplates.value.slice(0, 30)))
}

function describeFilters() {
  const parts = []
  if (filters.year_start || filters.year_end) {
    parts.push(`${filters.year_start ?? '—'}-${filters.year_end ?? '—'}年`)
  }
  if (filters.provinces.length) {
    parts.push(`${filters.provinces.length}省`)
  }
  if (filters.company_keyword) {
    parts.push(`企业:${filters.company_keyword}`)
  }
  if (filters.product_categories.length) {
    parts.push(`${filters.product_categories.length}品类`)
  }
  if (filters.issue_items.length) {
    parts.push(`${filters.issue_items.length}不合格项`)
  }
  if (filters.announcement_ids.length) {
    parts.push(`${filters.announcement_ids.length}批次`)
  }
  return parts.join(' ') || '全量'
}

function saveCurrentSearch() {
  const label = describeFilters() + ` @${new Date().toLocaleString()}`
  const snapshot = JSON.parse(JSON.stringify(filters))
  searchHistory.value.unshift({
    id: Date.now(),
    label,
    filters: snapshot
  })
  searchHistory.value = searchHistory.value.slice(0, 20)
  persistHistory()
  ElMessage.success('已保存到历史检索')
}

function applyHistory(row) {
  if (!row?.filters) {
    return
  }
  Object.assign(filters, {
    year_start: row.filters.year_start ?? null,
    year_end: row.filters.year_end ?? null,
    provinces: row.filters.provinces || [],
    company_keyword: row.filters.company_keyword || '',
    product_categories: row.filters.product_categories || [],
    issue_items: row.filters.issue_items || [],
    announcement_ids: row.filters.announcement_ids || []
  })
  loadAnnouncementOptions()
  runSearch()
}

function saveTemplate() {
  const name = newTemplateName.value.trim()
  if (!name) {
    ElMessage.warning('请填写模板名称')
    return
  }
  columnTemplates.value.unshift({
    id: Date.now(),
    name,
    columns: [...orderedColumnKeys.value],
    aliases: { ...columnAliases }
  })
  persistTemplates()
  newTemplateName.value = ''
  ElMessage.success('模板已保存')
}

function applyTemplate(row) {
  selectedColumnKeys.value = [...row.columns]
  orderedColumnKeys.value = [...row.columns]
  Object.keys(columnAliases).forEach((k) => delete columnAliases[k])
  if (row.aliases) {
    Object.assign(columnAliases, row.aliases)
  }
  ElMessage.success('已套用模板')
}

function removeTemplate(id) {
  columnTemplates.value = columnTemplates.value.filter((t) => t.id !== id)
  persistTemplates()
}

async function loadFieldSchema() {
  const res = await getSamplingSearchFieldSchema()
  fieldGroups.value = res.data.groups || []
  defaultColumns.value = res.data.default_columns || []
  selectedColumnKeys.value = [...defaultColumns.value]
  orderedColumnKeys.value = [...defaultColumns.value]
}

async function loadFilterOptions() {
  const res = await getSamplingSearchOptions({
    year_start: filters.year_start || undefined,
    year_end: filters.year_end || undefined
  })
  options.provinces = res.data.provinces || []
  options.product_categories = res.data.product_categories || []
  options.issue_items = res.data.issue_items || []
  options.announcements = res.data.announcements || []
}

async function loadAnnouncementOptions() {
  const res = await getSamplingSearchOptions({
    year_start: filters.year_start || undefined,
    year_end: filters.year_end || undefined
  })
  options.announcements = res.data.announcements || []
}

watch(
  () => [filters.year_start, filters.year_end],
  () => {
    loadAnnouncementOptions()
  }
)

function resetFilters() {
  filters.year_start = null
  filters.year_end = null
  filters.provinces = []
  filters.company_keyword = ''
  filters.product_categories = []
  filters.issue_items = []
  filters.announcement_ids = []
  pagination.page = 1
  loadAnnouncementOptions()
}

function buildQueryBody() {
  const sortOrder = sortState.order === 'ascending' ? 'asc' : 'desc'
  return {
    year_start: filters.year_start,
    year_end: filters.year_end,
    provinces: filters.provinces,
    company_keyword: filters.company_keyword || undefined,
    product_categories: filters.product_categories,
    issue_items: filters.issue_items,
    announcement_ids: filters.announcement_ids,
    page: pagination.page,
    limit: pagination.limit,
    sort_field: sortState.prop || 'source_publish_date',
    sort_order: sortOrder
  }
}

async function runSearch() {
  loading.value = true
  try {
    const res = await postSamplingSearchQuery(buildQueryBody())
    tableRows.value = res.data || []
    pagination.total = res.pagination?.total ?? 0
    chartData.province_top10 = res.chart?.province_top10 || []
    chartData.issue_top10 = res.chart?.issue_top10 || []
    await nextTick()
    renderCharts()
  } catch {
    tableRows.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function onSortChange({ prop, order }) {
  if (!prop || !order) {
    return
  }
  sortState.prop = prop
  sortState.order = order
  pagination.page = 1
  runSearch()
}

function renderCharts() {
  if (!provinceChartRef.value || !issueChartRef.value) {
    return
  }
  if (!provinceChart) {
    provinceChart = echarts.init(provinceChartRef.value)
  }
  if (!issueChart) {
    issueChart = echarts.init(issueChartRef.value)
  }
  const pData = chartData.province_top10
  const iData = chartData.issue_top10
  provinceChart.setOption({
    title: { text: '省份分布 Top10', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 20, bottom: 40, top: 40 },
    xAxis: { type: 'category', data: pData.map((d) => d.name), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: pData.map((d) => d.value), itemStyle: { color: '#667eea' } }]
  })
  issueChart.setOption({
    title: { text: '不合格项目 Top10', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 120, right: 20, bottom: 20, top: 40 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: iData.map((d) => d.name).reverse() },
    series: [{ type: 'bar', data: iData.map((d) => d.value).reverse(), itemStyle: { color: '#764ba2' } }]
  })
}

async function exportData(scope, format) {
  if (!orderedColumnKeys.value.length) {
    ElMessage.warning('请至少选择一列')
    return
  }
  exporting.value = true
  try {
    const sortOrder = sortState.order === 'ascending' ? 'asc' : 'desc'
    const labels = {}
    orderedColumnKeys.value.forEach((k) => {
      if (columnAliases[k]) {
        labels[k] = columnAliases[k]
      }
    })
    const blob = await postSamplingSearchExport({
      ...buildQueryBody(),
      scope,
      format,
      columns: orderedColumnKeys.value,
      column_labels: labels,
      include_filter_sheet: includeFilterSheet.value,
      mask_sensitive: maskSensitive.value
    })
    if (blob.type && blob.type.includes('json')) {
      const text = await blob.text()
      try {
        const err = JSON.parse(text)
        ElMessage.error(err.message || '导出失败')
      } catch {
        ElMessage.error('导出失败')
      }
      return
    }
    const ext = format === 'csv' ? 'csv' : 'xlsx'
    const name = `${describeFilters().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.${ext}`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出已开始下载')
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

function handleResize() {
  provinceChart?.resize()
  issueChart?.resize()
}

onMounted(async () => {
  loadLocalStorage()
  await loadFieldSchema()
  await loadFilterOptions()
  await runSearch()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  provinceChart?.dispose()
  issueChart?.dispose()
})
</script>

<style scoped>
.sampling-search {
  max-width: 1400px;
  margin: 0 auto;
}
.mt-16 {
  margin-top: 16px;
}
.mt-8 {
  margin-top: 8px;
}
.filter-card .page-title {
  font-size: 18px;
  font-weight: 600;
}
.page-subtitle {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.chart-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.chart-box {
  flex: 1;
  min-width: 280px;
  height: 280px;
}
.tool-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.field-group {
  margin-bottom: 12px;
}
.group-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.field-cb {
  display: block;
  margin-left: 0 !important;
}
.drag-list ul {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
}
.drag-item {
  padding: 8px 12px;
  margin-bottom: 6px;
  background: #f5f7fa;
  border-radius: 4px;
  cursor: grab;
}
.key-tag {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}
.drag-title {
  font-size: 13px;
  color: #606266;
}
.hint {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}
.template-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.table-card {
  min-height: 320px;
}
</style>
