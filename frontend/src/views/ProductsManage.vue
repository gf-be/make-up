<template>
  <div class="products-manage">
    <el-card shadow="never" v-loading="listLoading">
      <template #header>
        <div class="toolbar">
          <span class="title">产品管理</span>
          <div class="toolbar-actions">
            <el-input
              v-model="filters.keyword"
              placeholder="产品名 / 批次 / 企业 / ID"
              clearable
              style="width: 220px"
              @keyup.enter="loadList"
            />
            <el-button type="primary" @click="loadList">检索</el-button>
            <el-button @click="resetFilters">重置</el-button>
            <el-button type="success" @click="openCreate">新增记录</el-button>
          </div>
        </div>
      </template>

      <el-table :data="listRows" stripe size="small" row-key="id" empty-text="暂无数据" class="table-height">
        <el-table-column prop="id" label="ID" width="72" align="center" />
        <el-table-column prop="sequence_no" label="序号" width="56" align="center" />
        <el-table-column prop="batch_title" label="批次标题" min-width="140" show-overflow-tooltip />
        <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="manufacturer_name" label="生产企业" min-width="120" show-overflow-tooltip />
        <el-table-column prop="product_type_label" label="产品类型" width="90" />
        <el-table-column prop="announcement_type_label" label="通告类型" width="100" />
        <el-table-column label="通告ID" width="88" align="center">
          <template #default="{ row }">{{ row.announcement_id ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="飞检ID" width="80" align="center">
          <template #default="{ row }">{{ row.supervision_id ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next, sizes"
        :total="pagination.total"
        :page-size="pagination.limit"
        :current-page="pagination.page"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新增不合格产品记录' : `编辑 · ID ${editingId}`"
      width="820px"
      destroy-on-close
      class="product-edit-dialog"
      @closed="resetForm"
    >
      <div class="dialog-scroll">
        <el-tabs v-model="dialogTab">
          <el-tab-pane label="基础 / 产品与单位" name="basic">
            <el-form label-width="120px" class="dense-form">
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="批次标题" required>
                    <el-input v-model="form.batch_title" maxlength="255" show-word-limit />
                  </el-form-item>
                </el-col>
                <el-col :span="6">
                  <el-form-item label="批次序号" required>
                    <el-input-number v-model="form.sequence_no" :min="0" :step="1" controls-position="right" class="w-full" />
                  </el-form-item>
                </el-col>
                <el-col :span="6">
                  <el-form-item label="批次总数">
                    <el-input-number v-model="form.total_batches" :min="0" :step="1" controls-position="right" class="w-full" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="产品名称" required>
                <el-input v-model="form.product_name" maxlength="255" show-word-limit />
              </el-form-item>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="产品类型">
                    <el-select v-model="form.product_type" filterable allow-create default-first-option style="width: 100%">
                      <el-option label="化妆品 cosmetics" value="cosmetics" />
                      <el-option label="食品 food" value="food" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="通告类型">
                    <el-select v-model="form.announcement_type" filterable allow-create default-first-option style="width: 100%">
                      <el-option label="抽检 sampling" value="sampling" />
                      <el-option label="飞检 flight_inspection" value="flight_inspection" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="注册人/备案人">
                <el-input v-model="form.company_names" type="textarea" :rows="2" maxlength="2000" show-word-limit />
              </el-form-item>
              <el-form-item label="注册人地址">
                <el-input v-model="form.company_addresses" type="textarea" :rows="2" maxlength="2000" show-word-limit />
              </el-form-item>
              <el-form-item label="生产企业">
                <el-input v-model="form.manufacturer_name" maxlength="500" show-word-limit />
              </el-form-item>
              <el-form-item label="生产地址">
                <el-input v-model="form.manufacturer_address" type="textarea" :rows="2" maxlength="2000" show-word-limit />
              </el-form-item>
              <el-form-item label="被抽样单位">
                <el-input v-model="form.sample_unit_name" maxlength="500" show-word-limit />
              </el-form-item>
              <el-form-item label="抽样单位地址">
                <el-input v-model="form.sample_unit_address" type="textarea" :rows="2" maxlength="2000" show-word-limit />
              </el-form-item>
              <el-form-item label="经销企业">
                <el-input v-model="form.operator_name" maxlength="500" show-word-limit />
              </el-form-item>
              <el-form-item label="经销地址">
                <el-input v-model="form.operator_address" type="textarea" :rows="2" maxlength="2000" show-word-limit />
              </el-form-item>
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="包装规格">
                    <el-input v-model="form.package_spec" maxlength="255" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="批号">
                    <el-input v-model="form.batch_no" maxlength="255" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="产品区域">
                    <el-input v-model="form.product_region" maxlength="255" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="生产日期">
                    <el-input v-model="form.production_date" maxlength="100" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="限期使用">
                    <el-input v-model="form.expiry_date" maxlength="255" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="涉嫌假冒">
                    <el-switch v-model="form.is_counterfeit" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="批准文号">
                    <el-input v-model="form.registration_no" maxlength="255" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="生产许可证">
                    <el-input v-model="form.production_license_no" maxlength="255" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="检验机构">
                <el-input v-model="form.inspection_institution" maxlength="255" />
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="检验与备注" name="inspect">
            <el-form label-width="120px" class="dense-form">
              <el-form-item label="不合格项目（主表）">
                <el-input v-model="form.unqualified_items" type="textarea" :rows="4" maxlength="65000" show-word-limit />
              </el-form-item>
              <el-form-item label="检验结果">
                <el-input v-model="form.inspection_result" type="textarea" :rows="3" maxlength="65000" show-word-limit />
              </el-form-item>
              <el-form-item label="标准规定">
                <el-input v-model="form.requirement" type="textarea" :rows="3" maxlength="65000" show-word-limit />
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="form.remarks" type="textarea" :rows="2" maxlength="65000" show-word-limit />
              </el-form-item>
              <el-form-item label="问题类别">
                <el-input v-model="form.issue_category" maxlength="100" />
              </el-form-item>
              <el-form-item label="主类别字段">
                <el-input v-model="form.product_category" maxlength="100" placeholder="与下方「拆分类别」二选一或同时维护" />
              </el-form-item>
              <el-form-item label="拆分不合格项">
                <el-input
                  v-model="form.issue_items_text"
                  type="textarea"
                  :rows="4"
                  placeholder="每行一条；保存时写入关联表"
                />
              </el-form-item>
              <el-form-item label="拆分产品类别">
                <el-input
                  v-model="form.product_categories_text"
                  type="textarea"
                  :rows="3"
                  placeholder="每行一条；保存时写入关联表"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- <el-tab-pane label="来源与关联" name="source">
            <el-form label-width="140px" class="dense-form">
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="公告 ID">
                    <el-input v-model="form.announcement_id" clearable placeholder="可空" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="公告明细 ID">
                    <el-input v-model="form.announcement_detail_id" clearable placeholder="可空" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="飞检 ID">
                    <el-input v-model="form.supervision_id" clearable placeholder="可空" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="飞检明细 ID">
                    <el-input v-model="form.supervision_detail_id" clearable placeholder="可空" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="关联企业 ID">
                    <el-input v-model="form.company_id" clearable placeholder="可空" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="来源年份">
                    <el-input v-model="form.source_year" clearable placeholder="可空" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="source_key">
                <el-input v-model="form.source_key" maxlength="80" />
              </el-form-item>
              <el-form-item label="source_no">
                <el-input v-model="form.source_no" maxlength="255" />
              </el-form-item>
              <el-form-item label="source_title">
                <el-input v-model="form.source_title" maxlength="500" show-word-limit />
              </el-form-item>
              <el-form-item label="发布日期">
                <el-input v-model="form.source_publish_date" placeholder="可选 ISO / 文本，留空不写" maxlength="40" />
              </el-form-item>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="生产省份">
                    <el-input v-model="form.manufacturer_province" maxlength="100" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="生产城市">
                    <el-input v-model="form.manufacturer_city" maxlength="100" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="抽样省份">
                    <el-input v-model="form.sampled_province" maxlength="100" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="抽样城市">
                    <el-input v-model="form.sampled_city" maxlength="100" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="综合省份显示">
                <el-input v-model="form.province_display" maxlength="100" />
              </el-form-item>
            </el-form>
          </el-tab-pane> -->
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listManageUnqualifiedProducts,
  createManageUnqualifiedProduct,
  updateManageUnqualifiedProduct,
  deleteManageUnqualifiedProduct,
  getManageUnqualifiedProductDetail
} from '@/api/index'

function emptyForm() {
  return {
    batch_title: '',
    total_batches: 0,
    sequence_no: 1,
    product_name: '',
    company_names: '',
    company_addresses: '',
    manufacturer_name: '',
    manufacturer_address: '',
    operator_name: '',
    operator_address: '',
    sample_unit_name: '',
    sample_unit_address: '',
    package_spec: '',
    batch_no: '',
    production_date: '',
    expiry_date: '',
    product_region: '',
    registration_no: '',
    production_license_no: '',
    inspection_institution: '',
    unqualified_items: '',
    inspection_result: '',
    requirement: '',
    remarks: '',
    product_category: '',
    manufacturer_province: '',
    manufacturer_city: '',
    sampled_province: '',
    sampled_city: '',
    issue_category: '',
    product_type: 'cosmetics',
    announcement_type: 'sampling',
    source_key: '',
    source_no: '',
    source_title: '',
    source_publish_date: '',
    source_year: '',
    province_display: '',
    company_id: '',
    announcement_id: '',
    announcement_detail_id: '',
    supervision_id: '',
    supervision_detail_id: '',
    is_counterfeit: false,
    issue_items_text: '',
    product_categories_text: ''
  }
}

function linesToBlocks(text) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function buildPayload(form) {
  const numOrNull = (v) => {
    if (v === '' || v === undefined || v === null) return null
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  }

  const body = {
    batch_title: form.batch_title.trim(),
    total_batches: numOrNull(form.total_batches) ?? 0,
    sequence_no: Number.parseInt(form.sequence_no, 10),
    product_name: form.product_name.trim(),
    company_names: form.company_names || null,
    company_addresses: form.company_addresses || null,
    manufacturer_name: form.manufacturer_name || null,
    manufacturer_address: form.manufacturer_address || null,
    operator_name: form.operator_name || null,
    operator_address: form.operator_address || null,
    sample_unit_name: form.sample_unit_name || null,
    sample_unit_address: form.sample_unit_address || null,
    package_spec: form.package_spec || null,
    batch_no: form.batch_no || null,
    production_date: form.production_date || null,
    expiry_date: form.expiry_date || null,
    product_region: form.product_region || null,
    registration_no: form.registration_no || null,
    production_license_no: form.production_license_no || null,
    inspection_institution: form.inspection_institution || null,
    unqualified_items: form.unqualified_items || null,
    inspection_result: form.inspection_result || null,
    requirement: form.requirement || null,
    remarks: form.remarks || null,
    product_category: form.product_category || null,
    manufacturer_province: form.manufacturer_province || null,
    manufacturer_city: form.manufacturer_city || null,
    sampled_province: form.sampled_province || null,
    sampled_city: form.sampled_city || null,
    issue_category: form.issue_category || null,
    product_type: form.product_type || 'cosmetics',
    announcement_type: form.announcement_type || 'sampling',
    source_key: form.source_key || null,
    source_no: form.source_no || null,
    source_title: form.source_title || null,
    source_publish_date: form.source_publish_date || null,
    source_year: numOrNull(form.source_year),
    province_display: form.province_display || null,
    company_id: numOrNull(form.company_id),
    announcement_id: numOrNull(form.announcement_id),
    announcement_detail_id: numOrNull(form.announcement_detail_id),
    supervision_id: numOrNull(form.supervision_id),
    supervision_detail_id: numOrNull(form.supervision_detail_id),
    is_counterfeit: form.is_counterfeit,
    issue_items: linesToBlocks(form.issue_items_text || ''),
    product_categories: linesToBlocks(form.product_categories_text || '')
  }

  if (!Number.isFinite(body.sequence_no)) {
    throw new Error('批次序号须为整数')
  }
  return body
}

const listLoading = ref(false)
const saving = ref(false)
const listRows = ref([])
const pagination = reactive({ page: 1, limit: 20, total: 0 })

const filters = reactive({
  keyword: ''
})

const dialogVisible = ref(false)
const dialogMode = ref('create')
const dialogTab = ref('basic')
const editingId = ref(null)
const form = reactive(emptyForm())

function resetForm() {
  Object.assign(form, emptyForm())
  dialogTab.value = 'basic'
  editingId.value = null
}

function normalizeListRes(res) {
  const rows = Array.isArray(res?.data) ? res.data : []
  const total = Number(res?.pagination?.total ?? 0)
  return { rows, total }
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await listManageUnqualifiedProducts({
      keyword: filters.keyword?.trim() || undefined,
      page: pagination.page,
      limit: pagination.limit
    })
    const { rows, total } = normalizeListRes(res)
    listRows.value = rows
    pagination.total = total
  } catch {
    listRows.value = []
  } finally {
    listLoading.value = false
  }
}

function resetFilters() {
  filters.keyword = ''
  pagination.page = 1
  loadList()
}

function onPageChange(p) {
  pagination.page = p
  loadList()
}

function onSizeChange(sz) {
  pagination.limit = sz
  pagination.page = 1
  loadList()
}

function openCreate() {
  dialogMode.value = 'create'
  resetForm()
  dialogVisible.value = true
}

async function openEdit(row) {
  dialogMode.value = 'edit'
  resetForm()
  editingId.value = row.id
  dialogVisible.value = true
  try {
    const res = await getManageUnqualifiedProductDetail(row.id)
    const d = res?.data
    if (!d) {
      ElMessage.warning('未获取到详情')
      return
    }
    Object.assign(form, {
      batch_title: d.batch_title ?? '',
      total_batches: d.total_batches ?? 0,
      sequence_no: d.sequence_no ?? 1,
      product_name: d.product_name ?? '',
      company_names: d.company_names ?? '',
      company_addresses: d.company_addresses ?? '',
      manufacturer_name: d.manufacturer_name ?? '',
      manufacturer_address: d.manufacturer_address ?? '',
      operator_name: d.operator_name ?? '',
      operator_address: d.operator_address ?? '',
      sample_unit_name: d.sample_unit_name ?? '',
      sample_unit_address: d.sample_unit_address ?? '',
      package_spec: d.package_spec ?? '',
      batch_no: d.batch_no ?? '',
      production_date: d.production_date ?? '',
      expiry_date: d.expiry_date ?? '',
      product_region: d.product_region ?? '',
      registration_no: d.registration_no ?? '',
      production_license_no: d.production_license_no ?? '',
      inspection_institution: d.inspection_institution ?? '',
      unqualified_items: d.unqualified_items ?? '',
      inspection_result: d.inspection_result ?? '',
      requirement: d.requirement ?? '',
      remarks: d.remarks ?? '',
      product_category: d.product_category ?? '',
      manufacturer_province: d.manufacturer_province ?? '',
      manufacturer_city: d.manufacturer_city ?? '',
      sampled_province: d.sampled_province ?? '',
      sampled_city: d.sampled_city ?? '',
      issue_category: d.issue_category ?? '',
      product_type: d.product_type ?? 'cosmetics',
      announcement_type: d.announcement_type ?? 'sampling',
      source_key: d.source_key ?? '',
      source_no: d.source_no ?? '',
      source_title: d.source_title ?? '',
      source_publish_date: formatDateForInput(d.source_publish_date),
      source_year: d.source_year != null ? String(d.source_year) : '',
      province_display: d.province_display ?? '',
      company_id: d.company_id != null ? String(d.company_id) : '',
      announcement_id: d.announcement_id != null ? String(d.announcement_id) : '',
      announcement_detail_id: d.announcement_detail_id != null ? String(d.announcement_detail_id) : '',
      supervision_id: d.supervision_id != null ? String(d.supervision_id) : '',
      supervision_detail_id: d.supervision_detail_id != null ? String(d.supervision_detail_id) : '',
      is_counterfeit: !!d.is_counterfeit,
      issue_items_text: Array.isArray(d.issue_items) ? d.issue_items.join('\n') : '',
      product_categories_text: Array.isArray(d.product_categories) ? d.product_categories.join('\n') : ''
    })
  } catch {
    dialogVisible.value = false
  }
}

function formatDateForInput(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'string') {
    return v.replace('T', ' ').slice(0, 19)
  }
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

async function submitForm() {
  if (!form.batch_title?.trim()) {
    ElMessage.warning('请填写批次标题')
    return
  }
  if (!form.product_name?.trim()) {
    ElMessage.warning('请填写产品名称')
    return
  }

  let body
  try {
    body = buildPayload(form)
  } catch (err) {
    ElMessage.warning(err?.message || '请检查表单')
    return
  }

  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      await createManageUnqualifiedProduct(body)
      ElMessage.success('已创建')
      dialogVisible.value = false
      pagination.page = 1
      await loadList()
    } else {
      await updateManageUnqualifiedProduct(editingId.value, body)
      ElMessage.success('已保存')
      dialogVisible.value = false
      await loadList()
    }
  } catch {
    /* axios 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除 ID ${row.id}「${row.product_name || '未命名'}」？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await deleteManageUnqualifiedProduct(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch {
    /* 拦截器已提示 */
  }
}

loadList()
</script>

<style scoped>
.products-manage {
  max-width: 1400px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar .title {
  font-weight: 600;
  font-size: 16px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.dialog-scroll {
  max-height: min(70vh, 640px);
  overflow-y: auto;
  padding-right: 4px;
}

.dense-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.w-full {
  width: 100%;
}
</style>
