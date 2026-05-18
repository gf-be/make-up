<template>
  <div class="category-manage">
    <el-card shadow="never" class="page-card">
      <el-row :gutter="16" class="layout-row">
        <el-col :xs="24" :md="8" :lg="7" class="left-col">
          <el-card shadow="never" class="panel-card" v-loading="typesLoading || catalogLoading">
            <template #header>
              <div class="panel-header">
                <span class="panel-title">分类</span>
                <div class="panel-actions">
                  <el-button type="primary" link @click="openTypeDialog">新增类型</el-button>
                  <el-button type="primary" link :disabled="!selectedProductType" @click="openCategoryDialog">新增分类</el-button>
                  <el-button link type="primary" @click="reloadTree">刷新</el-button>
                </div>
              </div>
            </template>

            <el-tree
              v-if="categoryTree.length"
              class="category-tree"
              :data="categoryTree"
              node-key="key"
              :props="treeProps"
              default-expand-all
              highlight-current
              :expand-on-click-node="false"
              @node-click="handleTreeNodeClick"
            >
           
              <template #default="{ data }">
                
                <div class="tree-node">
                  <span class="tree-node-label">{{ data.label }}</span>
                  <el-tag v-if="data.type === 'category'" size="small" type="info">
                    {{ data.usage_count ?? 0 }}
                  </el-tag>
                </div>
              </template>
            </el-tree>
            <el-empty v-else-if="!typesLoading && !catalogLoading" description="暂无类型或分类" />
          </el-card>
        </el-col>

        <el-col :xs="24" :md="16" :lg="17" class="right-col">
          <el-card shadow="never" class="panel-card" v-loading="abstractLoading">
            <template #header>
              <div class="right-header">
                <div>
                  <span class="panel-title">产品列表</span>
                  <!-- <span v-if="selectedCategoryName" class="panel-sub">
                    {{ currentTypeLabel }} / {{ selectedCategoryName }}
                  </span> -->
                </div>
                <el-button
                  type="primary"
                  :disabled="!selectedCategoryName"
                  @click="openAbstractDialog()"
                >
                  新增抽象产品
                </el-button>
              </div>
            </template>

            <el-empty
              v-if="!selectedCategoryName"
              description="请先在左侧选择二级分类"
              :image-size="96"
            />

            <template v-else>
              <el-table
                :data="abstractRows"
                stripe
                border
                row-key="id"
                empty-text="该分类下暂无抽象产品"
              >
                <el-table-column label="图片" width="92" align="center">
                  <template #default="{ row }">
                    <el-image
                      v-if="row.image_url"
                      class="abstract-thumb"
                      :src="row.image_url"
                      fit="cover"
                      :preview-src-list="[row.image_url]"
                      preview-teleported
                    >
                      <template #error>
                        <div class="image-fallback">无图</div>
                      </template>
                    </el-image>
                    <div v-else class="image-fallback">无图</div>
                  </template>
                </el-table-column>
                <el-table-column prop="abstract_name" label="名称" min-width="180" show-overflow-tooltip />
                <el-table-column label="类型" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ getTypeLabel(row.product_type) }} / {{ row.category_name }}
                  </template>
                </el-table-column>
                <el-table-column prop="image_url" label="图片地址" min-width="260" show-overflow-tooltip />
                <el-table-column prop="updated_at" label="更新时间" width="178">
                  <template #default="{ row }">{{ formatDateTime(row.updated_at || row.created_at) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link @click="openAbstractDialog(row)">编辑</el-button>
                    <el-button type="danger" link :loading="deletingAbstractId === row.id" @click="handleDeleteAbstract(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-dialog
      v-model="typeDialogVisible"
      title="新增产品类型"
      width="min(520px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
    >
      <el-form label-width="92px" class="category-dialog-form">
        <el-form-item label="类型键" required>
          <el-input
            v-model="newTypeKey"
            placeholder="数据库内存储的名称"
            maxlength="50"
            show-word-limit
            clearable
            @keyup.enter="handleCreateProductType"
          />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input
            v-model="newTypeLabel"
            placeholder="可选，如 化妆品"
            maxlength="100"
            clearable
            @keyup.enter="handleCreateProductType"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingType" :disabled="!newTypeKey.trim()" @click="handleCreateProductType">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryDialogVisible"
      title="新增分类"
      width="min(520px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
    >
      <el-form label-width="92px" class="category-dialog-form">
        <el-form-item label="产品类型" required>
          <el-select v-model="selectedProductType" filterable style="width: 100%">
            <el-option
              v-for="item in productTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分类名称" required>
          <el-input
            v-model="newCategoryName"
            placeholder="如 保湿、修护、染发"
            maxlength="100"
            show-word-limit
            clearable
            @keyup.enter="handleCreateCategory"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="creatingCategory"
          :disabled="!selectedProductType || !newCategoryName.trim()"
          @click="handleCreateCategory"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="abstractDialogVisible"
      :title="editingAbstractId ? '编辑抽象产品' : '新增抽象产品'"
      width="min(620px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
    >
      <el-form label-width="96px" class="abstract-form">
        <el-form-item label="名称" required>
          <el-input
            v-model="abstractForm.abstract_name"
            placeholder="如：染发膏"
            maxlength="150"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="图片地址">
          <el-input
            v-model="abstractForm.image_url"
            placeholder="https://..."
            maxlength="1000"
            clearable
          />
        </el-form-item>
        <el-form-item label="产品类型" required>
          <el-select v-model="abstractForm.product_type" filterable style="width: 100%" @change="onAbstractFormTypeChange">
            <el-option
              v-for="item in productTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="所属分类" required>
          <el-select v-model="abstractForm.category_name" filterable style="width: 100%">
            <el-option
              v-for="cat in formCategoryOptions"
              :key="cat.id || cat.category_name"
              :label="cat.category_name"
              :value="cat.category_name"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="abstractForm.image_url" label="预览">
          <el-image class="abstract-preview" :src="abstractForm.image_url" fit="cover">
            <template #error>
              <div class="preview-fallback">图片无法预览</div>
            </template>
          </el-image>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="abstractDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingAbstract" @click="saveAbstractProduct">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  createCategoryAbstractProduct,
  createCategoryCatalog,
  createCategoryCatalogProductType,
  deleteCategoryAbstractProduct,
  getCategoryCatalogProductTypes,
  listCategoryAbstractProducts,
  listCategoryCatalog,
  updateCategoryAbstractProduct
} from '@/api/index'

const treeProps = {
  label: 'label',
  children: 'children'
}

const typesLoading = ref(false)
const catalogLoading = ref(false)
const abstractLoading = ref(false)
const creatingType = ref(false)
const creatingCategory = ref(false)
const savingAbstract = ref(false)
const deletingAbstractId = ref(null)

const productTypeOptions = ref([])
const categoriesByType = reactive({})
const selectedProductType = ref('')
const selectedCategoryName = ref('')
const abstractRows = ref([])
const newTypeKey = ref('')
const newTypeLabel = ref('')
const newCategoryName = ref('')
const typeDialogVisible = ref(false)
const categoryDialogVisible = ref(false)
const abstractDialogVisible = ref(false)
const editingAbstractId = ref(null)
const abstractForm = reactive({
  product_type: '',
  category_name: '',
  abstract_name: '',
  image_url: ''
})

const currentTypeLabel = computed(() => getTypeLabel(selectedProductType.value))

const selectedCategoryRows = computed(() => categoriesByType[selectedProductType.value] || [])

const formCategoryOptions = computed(() => categoriesByType[abstractForm.product_type] || [])

const categoryTree = computed(() => productTypeOptions.value.map((type) => ({
  key: `type:${type.value}`,
  type: 'type',
  product_type: type.value,
  label: type.label,
  children: (categoriesByType[type.value] || []).map((cat) => ({
    key: `cat:${type.value}:${cat.category_name}`,
    type: 'category',
    product_type: type.value,
    label: cat.category_name,
    category_name: cat.category_name,
    usage_count: cat.usage_count
  }))
})))

function getTypeLabel(value) {
  const opt = productTypeOptions.value.find((o) => o.value === value)
  return opt?.label || value || ''
}

function formatDateTime(value) {
  if (value == null || value === '') return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openTypeDialog() {
  newTypeKey.value = ''
  newTypeLabel.value = ''
  typeDialogVisible.value = true
}

function openCategoryDialog() {
  if (!selectedProductType.value && productTypeOptions.value.length) {
    selectedProductType.value = productTypeOptions.value[0].value
  }
  newCategoryName.value = ''
  categoryDialogVisible.value = true
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

async function loadCatalogForType(productType) {
  if (!productType) return []
  catalogLoading.value = true
  try {
    const res = await listCategoryCatalog({ product_type: productType })
    categoriesByType[productType] = res.data || []
    return categoriesByType[productType]
  } finally {
    catalogLoading.value = false
  }
}

async function ensureCatalogForType(productType) {
  if (!productType) return []
  if (categoriesByType[productType]) return categoriesByType[productType]
  return loadCatalogForType(productType)
}

async function loadAbstractProducts() {
  if (!selectedProductType.value || !selectedCategoryName.value) {
    abstractRows.value = []
    return
  }
  abstractLoading.value = true
  try {
    const res = await listCategoryAbstractProducts({
      product_type: selectedProductType.value,
      category_name: selectedCategoryName.value
    })
    abstractRows.value = res.data || []
  } finally {
    abstractLoading.value = false
  }
}

async function reloadTree() {
  await loadProductTypes()
  await Promise.all(productTypeOptions.value.map((item) => loadCatalogForType(item.value)))
  if (!selectedCategoryName.value && selectedProductType.value) {
    const rows = categoriesByType[selectedProductType.value] || []
    selectedCategoryName.value = rows[0]?.category_name || ''
  }
  if (selectedProductType.value && selectedCategoryName.value) {
    await loadAbstractProducts()
  }
}

async function handleTreeNodeClick(data) {
  if (data.type === 'type') {
    selectedProductType.value = data.product_type
    await ensureCatalogForType(data.product_type)
    const rows = categoriesByType[data.product_type] || []
    selectedCategoryName.value = rows[0]?.category_name || ''
    return
  }
  selectedProductType.value = data.product_type
  selectedCategoryName.value = data.category_name
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
      selectedCategoryName.value = ''
      await loadCatalogForType(v)
    }
    typeDialogVisible.value = false
    ElMessage.success('已新增产品类型')
  } catch {
    /* request interceptor already shows errors */
  } finally {
    creatingType.value = false
  }
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim()
  if (!selectedProductType.value || !name) return
  creatingCategory.value = true
  try {
    await createCategoryCatalog({
      product_type: selectedProductType.value,
      category_name: name
    })
    newCategoryName.value = ''
    await loadCatalogForType(selectedProductType.value)
    selectedCategoryName.value = name
    categoryDialogVisible.value = false
    ElMessage.success('已新增分类')
  } catch {
    /* request interceptor already shows errors */
  } finally {
    creatingCategory.value = false
  }
}

async function onAbstractFormTypeChange(value) {
  await ensureCatalogForType(value)
  const rows = categoriesByType[value] || []
  if (!rows.some((cat) => cat.category_name === abstractForm.category_name)) {
    abstractForm.category_name = rows[0]?.category_name || ''
  }
}

async function openAbstractDialog(row = null) {
  editingAbstractId.value = row?.id || null
  abstractForm.product_type = row?.product_type || selectedProductType.value || productTypeOptions.value[0]?.value || ''
  await ensureCatalogForType(abstractForm.product_type)
  abstractForm.category_name = row?.category_name || selectedCategoryName.value || formCategoryOptions.value[0]?.category_name || ''
  abstractForm.abstract_name = row?.abstract_name || ''
  abstractForm.image_url = row?.image_url || ''
  abstractDialogVisible.value = true
}

async function saveAbstractProduct() {
  const name = abstractForm.abstract_name.trim()
  if (!abstractForm.product_type || !abstractForm.category_name || !name) {
    ElMessage.warning('请填写名称、产品类型和所属分类')
    return
  }
  savingAbstract.value = true
  const payload = {
    product_type: abstractForm.product_type,
    category_name: abstractForm.category_name,
    abstract_name: name,
    image_url: abstractForm.image_url.trim()
  }
  try {
    if (editingAbstractId.value) {
      await updateCategoryAbstractProduct(editingAbstractId.value, payload)
      ElMessage.success('已更新抽象产品')
    } else {
      await createCategoryAbstractProduct(payload)
      ElMessage.success('已新增抽象产品')
    }
    abstractDialogVisible.value = false
    selectedProductType.value = payload.product_type
    selectedCategoryName.value = payload.category_name
    await loadAbstractProducts()
  } catch {
    /* request interceptor already shows errors */
  } finally {
    savingAbstract.value = false
  }
}

async function handleDeleteAbstract(row) {
  try {
    await ElMessageBox.confirm(`确定删除抽象产品「${row.abstract_name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  deletingAbstractId.value = row.id
  try {
    await deleteCategoryAbstractProduct(row.id)
    ElMessage.success('已删除')
    await loadAbstractProducts()
  } catch {
    /* request interceptor already shows errors */
  } finally {
    deletingAbstractId.value = null
  }
}

watch(
  () => selectedProductType.value,
  async (pt, oldPt) => {
    if (!pt || pt === oldPt) return
    await ensureCatalogForType(pt)
    const rows = categoriesByType[pt] || []
    if (!rows.some((cat) => cat.category_name === selectedCategoryName.value)) {
      selectedCategoryName.value = rows[0]?.category_name || ''
    }
  }
)

watch(
  () => [selectedProductType.value, selectedCategoryName.value],
  () => {
    loadAbstractProducts()
  }
)

onMounted(async () => {
  await reloadTree()
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

.layout-row {
  align-items: stretch;
}

.panel-card {
  min-height: 360px;
}

.panel-header,
.right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-weight: 600;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.panel-sub {
  margin-left: 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.type-toolbar,
.category-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.category-toolbar {
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.category-tree {
  margin-top: 8px;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding-right: 8px;
}

.tree-node-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.abstract-thumb,
.abstract-preview {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.abstract-preview {
  width: 96px;
  height: 96px;
}

.image-fallback,
.preview-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color-light);
}

.category-dialog-form,
.abstract-form {
  padding-top: 8px;
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
