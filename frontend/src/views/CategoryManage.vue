<template>
  <div class="category-manage">
    <el-card shadow="never" class="page-card">
      <!-- <template #header>
        <div class="page-header">
          <span class="page-title">产品分类管理</span>
          <span class="page-hint">左侧选择产品类型；右侧维护该类型下的分类词条（数据源自拆分表 <code>unqualified_product_category_items</code> 与主表回填，亦可手工新增）</span>
        </div>
      </template> -->

      <el-row :gutter="16" class="layout-row">
        <el-col :xs="24" :md="8" :lg="7" class="left-col">
          <el-card shadow="never" class="panel-card" v-loading="typesLoading">
            <template #header>
              <span class="panel-title">产品类型</span>
            </template>
            <div class="type-toolbar">
              <el-input
                v-model="newTypeKey"
                placeholder="类型键，如 tobacco 或与导入数据一致的英文键"
                maxlength="50"
                show-word-limit
                clearable
              />
              <el-input
                v-model="newTypeLabel"
                placeholder="显示名称（可选）"
                maxlength="100"
                clearable
              />
              <el-button type="primary" :loading="creatingType" :disabled="!newTypeKey.trim()" @click="handleCreateProductType">
                新增类型
              </el-button>
            </div>
            <div class="type-list">
              <button
                v-for="opt in productTypeOptions"
                :key="opt.value"
                type="button"
                class="type-item"
                :class="{ 'type-item--active': opt.value === selectedProductType }"
                @click="selectedProductType = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <el-empty v-if="!typesLoading && !productTypeOptions.length" description="暂无类型数据" />
          </el-card>
        </el-col>

        <el-col :xs="24" :md="16" :lg="17" class="right-col">
          <el-card shadow="never" class="panel-card" v-loading="listLoading">
            <template #header>
              <div class="right-header">
                <span class="panel-title">产品分类</span>
                <!-- <span v-if="selectedProductType" class="panel-sub">{{ currentTypeLabel }}</span> -->
              </div>
            </template>

            <div class="toolbar">
              <el-input
                v-model="newCategoryName"
                placeholder="输入新的分类名称"
                maxlength="100"
                show-word-limit
                clearable
                style="max-width: 320px"
                @keyup.enter="handleCreate"
              />
              <el-button type="primary" :loading="creating" :disabled="!selectedProductType || !newCategoryName.trim()" @click="handleCreate">
                新增
              </el-button>
            </div>
            <!-- <p class="table-hint">双击表格行或点击左侧箭头展开，查看该分类关联的产品名称（最多 500 条）。</p> -->

            <el-table
              ref="catalogTableRef"
              :data="catalogRows"
              stripe
              border
              empty-text="该类型下暂无分类词条，请输入名称后新增"
              row-key="id"
              @row-dblclick="onCatalogRowDblClick"
              @expand-change="onCatalogExpandChange"
            >
              <el-table-column type="expand" width="42">
                <template #default="{ row }">
                  <div v-loading="expandState(row.id).loading" class="category-expand-panel">
                    <p v-if="expandState(row.id).loaded && expandState(row.id).items.length" class="expand-hint">
                      含 {{ expandState(row.id).items.length }} 条产品
                    </p>
                    <ul v-if="expandState(row.id).items.length" class="expand-product-list">
                      <li
                        v-for="p in expandState(row.id).items"
                        :key="`${row.id}-${p.id}-${String(p.product_name || '').trim()}`"
                        class="expand-product-row"
                      >
                        <span class="expand-product-name" :title="p.product_name">{{ p.product_name }}</span>
                        <el-select
                          class="expand-category-select"
                          size="small"
                          placeholder="修改分类"
                          filterable
                          :disabled="!catalogRows.length"
                          :model-value="row.category_name"
                          :loading="reassigningProductKey === `${row.id}:${p.id}`"
                          @change="(toCat) => onAssignProductCategory(row, p, toCat)"
                        >
                          <el-option
                            v-for="cat in catalogRows"
                            :key="cat.id"
                            :label="cat.category_name"
                            :value="cat.category_name"
                          />
                        </el-select>
                      </li>
                    </ul>
                    <el-empty
                      v-else-if="expandState(row.id).loaded"
                      description="暂无关联产品"
                      :image-size="72"
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="category_name" label="分类名称" min-width="180" show-overflow-tooltip />
              <el-table-column prop="usage_count" label="关联明细数" width="120" align="center">
                <template #default="{ row }">{{ row.usage_count ?? 0 }}</template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="178">
                <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="100" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button type="danger" link :loading="deletingId === row.id" @click="handleDelete(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  assignCategoryCatalogProduct,
  createCategoryCatalog,
  createCategoryCatalogProductType,
  deleteCategoryCatalog,
  getCategoryCatalogProductTypes,
  listCategoryCatalog,
  listCategoryCatalogProducts
} from '@/api/index'

const catalogTableRef = ref(null)
const typesLoading = ref(false)
const listLoading = ref(false)
const creating = ref(false)
const creatingType = ref(false)
const deletingId = ref(null)
/** `${catalogCategoryRowId}:${productRowId}` 提交修改分类时 */
const reassigningProductKey = ref('')

const productTypeOptions = ref([])
const selectedProductType = ref('')
const catalogRows = ref([])
const newCategoryName = ref('')
const newTypeKey = ref('')
const newTypeLabel = ref('')

/** 分类行 id → 展开区加载状态与产品列表 */
const expandRowsState = reactive({})

const currentTypeLabel = computed(() => {
  const opt = productTypeOptions.value.find((o) => o.value === selectedProductType.value)
  return opt?.label || selectedProductType.value || ''
})

function expandState(rowId) {
  if (!expandRowsState[rowId]) {
    expandRowsState[rowId] = { loading: false, loaded: false, items: [] }
  }
  return expandRowsState[rowId]
}

function resetExpandRowsState() {
  Object.keys(expandRowsState).forEach((k) => delete expandRowsState[k])
}

/** 按产品名称去重（trim 后相同视为重复，保留首条） */
function dedupeProductsByName(rows) {
  const seen = new Set()
  const out = []
  for (const r of rows || []) {
    const key = String(r?.product_name ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

async function loadCategoryProducts(row, { force = false } = {}) {
  const st = expandState(row.id)
  if (st.loading) return
  if (!force && st.loaded) return

  const pt = selectedProductType.value
  if (!pt) return

  if (force) {
    st.items = []
    st.loaded = false
  }

  st.loading = true
  try {
    const res = await listCategoryCatalogProducts({
      product_type: pt,
      category_name: row.category_name
    })
    st.items = dedupeProductsByName(res.data || [])
    st.loaded = true
  } catch {
    st.loaded = true
    st.items = []
  } finally {
    st.loading = false
  }
}

async function onAssignProductCategory(categoryRow, product, toCategory) {
  if (!toCategory || toCategory === categoryRow.category_name) return

  const pt = selectedProductType.value
  if (!pt) return

  reassigningProductKey.value = `${categoryRow.id}:${product.id}`
  try {
    await assignCategoryCatalogProduct({
      product_id: product.id,
      product_type: pt,
      from_category_name: categoryRow.category_name,
      to_category_name: toCategory
    })
    ElMessage.success('已修改该产品分类')
    await loadCatalog()
    await loadCategoryProducts(categoryRow, { force: true })
  } catch {
    /* 拦截器已提示 */
  } finally {
    reassigningProductKey.value = ''
  }
}

function onCatalogExpandChange(row, expandedRowsOrBool) {
  let open = false
  if (typeof expandedRowsOrBool === 'boolean') {
    open = expandedRowsOrBool
  } else if (Array.isArray(expandedRowsOrBool)) {
    open = expandedRowsOrBool.some((r) => r.id === row.id)
  }
  if (open) {
    loadCategoryProducts(row)
  }
}

function onCatalogRowDblClick(row) {
  catalogTableRef.value?.toggleRowExpansion(row)
  loadCategoryProducts(row)
}

async function handleCreateProductType() {
  const key = newTypeKey.value.trim()
  if (!key) return
  creatingType.value = true
  try {
    const res = await createCategoryCatalogProductType({
      product_type: key,
      display_label: newTypeLabel.value.trim() || undefined
    })
    newTypeKey.value = ''
    newTypeLabel.value = ''
    await loadProductTypes()
    const v = res?.data?.value
    if (v) {
      selectedProductType.value = v
    }
    ElMessage.success('已新增产品类型')
  } catch {
    /* 拦截器已提示 */
  } finally {
    creatingType.value = false
  }
}

function formatDateTime(value) {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadProductTypes() {
  typesLoading.value = true
  try {
    const res = await getCategoryCatalogProductTypes()
    productTypeOptions.value = res.data || []
    if (!selectedProductType.value && productTypeOptions.value.length) {
      selectedProductType.value = productTypeOptions.value[0].value
    }
  } finally {
    typesLoading.value = false
  }
}

async function loadCatalog() {
  const pt = selectedProductType.value
  resetExpandRowsState()
  if (!pt) {
    catalogRows.value = []
    return
  }
  listLoading.value = true
  try {
    const res = await listCategoryCatalog({ product_type: pt })
    catalogRows.value = res.data || []
  } finally {
    listLoading.value = false
  }
}

async function handleCreate() {
  const name = newCategoryName.value.trim()
  if (!selectedProductType.value || !name) return
  creating.value = true
  try {
    await createCategoryCatalog({
      product_type: selectedProductType.value,
      category_name: name
    })
    newCategoryName.value = ''
    await loadCatalog()
    ElMessage.success('已新增分类词条')
  } catch {
    /* 拦截器已提示 */
  } finally {
    creating.value = false
  }
}

async function handleDelete(row) {
  const usage = Number(row.usage_count || 0)
  const tip =
    usage > 0
      ? `该分类仍关联 ${usage} 条不合格产品明细（主表字段或拆分表标签）。删除仅从「分类词条库」移除，不会自动改掉明细上的文字，确定删除？`
      : '确定从词条库中删除该分类？'

  try {
    await ElMessageBox.confirm(tip, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  deletingId.value = row.id
  try {
    await deleteCategoryCatalog(row.id)
    ElMessage.success('已删除')
    await loadCatalog()
  } catch {
    /* 拦截器已提示 */
  } finally {
    deletingId.value = null
  }
}

watch(selectedProductType, () => {
  loadCatalog()
})

onMounted(async () => {
  await loadProductTypes()
  await loadCatalog()
})
</script>

<style scoped>
.category-manage {
  max-width: 1400px;
  margin: 0 auto;
}

.page-card {
  border-radius: 18px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.page-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.page-hint code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.layout-row {
  align-items: stretch;
}

.panel-card {
  min-height: 360px;
}

.panel-title {
  font-weight: 600;
}

.type-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.category-expand-panel {
  padding: 12px 16px 16px;
  min-height: 72px;
}

.expand-hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.expand-product-list {
  margin: 0;
  padding-left: 0;
  max-height: 320px;
  overflow: auto;
  line-height: 1.6;
  list-style: none;
}

.expand-product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.expand-product-row:last-child {
  border-bottom: none;
}

.expand-product-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-category-select {
  width: 200px;
  flex-shrink: 0;
}

.right-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-sub {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  font-size: 14px;
  cursor: pointer;
  color: var(--el-text-color-primary);
}

.type-item:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.type-item--active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.table-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.left-col,
.right-col {
  margin-bottom: 16px;
}

@media (min-width: 768px) {
  .left-col,
  .right-col {
    margin-bottom: 0;
  }
}
</style>
