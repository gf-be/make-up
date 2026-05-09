<template>
  <div class="companies-manage">
    <el-row :gutter="16" class="layout-row">
      <!-- 左侧：企业列表 -->
      <el-col :xs="24" :lg="9" class="left-col">
        <el-card shadow="never" class="list-card" v-loading="listLoading">
          <template #header>
            <div class="list-card-header">
              <span class="card-title">企业列表</span>
              <el-button type="success" size="small" plain @click="openImportDialog">批量导入信用代码</el-button>
            </div>
          </template>
          <el-form :model="filters" inline class="filter-form">
            <el-form-item label="名称">
              <el-input
                v-model="filters.name"
                placeholder="关键字"
                clearable
                style="width: 130px"
                @keyup.enter="loadList"
              />
            </el-form-item>
            <el-form-item label="信用代码">
              <el-input
                v-model="filters.credit_code"
                placeholder="模糊"
                clearable
                style="width: 118px"
                @keyup.enter="loadList"
              />
            </el-form-item>
            <el-form-item label="仅无社会信用代码">
              <el-checkbox v-model="filters.credit_code_empty" @change="onCreditEmptyChange" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="small" @click="loadList">检索</el-button>
              <el-button size="small" @click="resetListFilters">重置</el-button>
            </el-form-item>
          </el-form>
          <el-table
            :data="listRows"
            stripe
            row-key="id"
            size="small"
            highlight-current-row
            max-height="calc(100vh - 75px)"
            empty-text="暂无企业"
            @row-click="handleRowClick"
          >
            <el-table-column prop="name" label="企业名称" min-width="110"  />
            <el-table-column prop="credit_code" label="信用代码" min-width="110" show-overflow-tooltip>
              <template #default="{ row }">{{ row.credit_code || '—' }}</template>
            </el-table-column>
            <el-table-column prop="province" label="省" width="64" />
            <el-table-column prop="sampled_count" label="抽查" width="48" align="center" />
          </el-table>
          <el-pagination
            class="list-pagination"
            small
            layout="total, prev, pager, next"
            :total="pagination.total"
            :page-size="pagination.limit"
            :current-page="pagination.page"
            @current-change="onPageChange"
          />
        </el-card>
      </el-col>

      <!-- 右侧：详情与编辑 -->
      <el-col :xs="24" :lg="15" class="right-col">
        <el-card shadow="never" class="detail-card" v-loading="detailLoading">
          <template v-if="!selectedId">
            <el-empty description="请从左侧选择一家企业" />
          </template>

          <template v-else-if="detail">
            <div class="detail-head">
              <h2 class="detail-title">{{ detail.company.name }}</h2>
              <el-tag size="small">ID {{ selectedId }}</el-tag>
            </div>

            <el-tabs v-model="activeTab" class="detail-tabs">
              <el-tab-pane label="企业基本信息" name="basic">
                <!-- <el-descriptions v-if="detail.stats" title="抽查与检查汇总（系统统计）" :column="3" border size="small" class="stats-block">
                  <el-descriptions-item label="抽查次数（统计）">
                    {{ detail.stats.sampled_count ?? '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="抽样检查记录数">
                    {{ detail.stats.inspection_count ?? '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="飞行检查批次">
                    {{ detail.stats.supervision_count ?? '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最近抽查">
                    {{ detail.stats.last_sampled_at || '-' }}
                  </el-descriptions-item>
                </el-descriptions> -->

                <el-descriptions
                  v-if="detail.company"
                  title="企业详情表"
                  :column="2"
                  border
                  size="small"
                  class="company-master-block"
                >
                  <el-descriptions-item label="企业名称" :span="2">{{ detail.company.name || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="统一社会信用代码" :span="2">
                    {{ detail.company.credit_code || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="企业类型">
                    {{ companyTypeLabel(detail.company.type) }}
                  </el-descriptions-item>
                  <!-- <el-descriptions-item label="品牌">{{ detail.company.brand || '-' }}</el-descriptions-item> -->
                  <el-descriptions-item label="产品分类">{{ detail.company.product_category || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="省份">{{ detail.company.province || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="城市">{{ detail.company.city || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="地址" :span="2">{{ detail.company.address || '-' }}</el-descriptions-item>
                  <el-descriptions-item v-if="detail.company.updated_at" label="最近更新时间" >
                    {{ formatDbTime(detail.company.updated_at) }}
                  </el-descriptions-item>
                  <el-descriptions-item v-if="detail.company.updated_at" label="最近抽检时间" >
                    {{ formatDbTime(detail.company.last_sampled_at) || '-' }}
                  </el-descriptions-item>
                </el-descriptions>

                <div class="stats-hint">
                  社会信用代码可与中/日/美常见规则一致，填写后不得重复。
                </div>

                <el-form ref="formRef" :model="editForm" label-width="128px" class="edit-form">
                  <el-form-item
                    label="企业名称"
                    prop="name"
                    :rules="[{ required: true, message: '请输入企业名称', trigger: 'blur' }]"
                  >
                    <el-input v-model="editForm.name" maxlength="200" show-word-limit />
                  </el-form-item>
                  <el-form-item
                    label="社会信用代码"
                    prop="credit_code"
                    :rules="[{ validator: validateCreditCode, trigger: 'blur' }]"
                  >
                    <el-input
                      v-model="editForm.credit_code"
                      maxlength="20"
                      show-word-limit
                      placeholder="中国 18 位统一码 / 日本 13 位法人番号 / 美国 EIN；留空可清除"
                      clearable
                      style="width: 360px"
                    />
                  </el-form-item>
                  <el-form-item label="企业类型" prop="type">
                    <el-select v-model="editForm.type" style="width: 220px">
                      <el-option label="生产企业" value="manufacturer" />
                      <el-option label="经销商" value="distributor" />
                      <el-option label="销售商" value="seller" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="品牌" >
                    <el-input v-model="editForm.brand" maxlength="120" clearable placeholder="可不填品牌名称"/>
                  </el-form-item>
                  <el-form-item label="产品分类">
                    <el-input v-model="editForm.product_category" maxlength="100" placeholder="如：化妆品" clearable />
                  </el-form-item>
                  <el-form-item label="省份">
                    <el-input v-model="editForm.province" maxlength="50" clearable />
                  </el-form-item>
                  <el-form-item label="城市">
                    <el-input v-model="editForm.city" maxlength="50" clearable />
                  </el-form-item>
                  <el-form-item label="地址">
                    <el-input v-model="editForm.address" type="textarea" :rows="3" maxlength="500" show-word-limit />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" :loading="saving" @click="saveBasic">保存主档</el-button>
                    <el-button @click="reloadDetail">取消</el-button>
                  </el-form-item>
                </el-form>
              </el-tab-pane>

              <!-- <el-tab-pane label="被抽查记录" name="records">
                <el-table :data="detail.history || []" stripe border max-height="calc(100vh - 320px)" size="small">
                  <el-table-column type="index" label="#" width="50" />
                  <el-table-column prop="title" label="关联标题/批次" min-width="180" show-overflow-tooltip />
                  <el-table-column prop="source_type" label="来源" width="100">
                    <template #default="{ row }">{{ sourceTypeLabel(row.source_type) }}</template>
                  </el-table-column>
                  <el-table-column prop="product_name" label="产品" min-width="120" show-overflow-tooltip />
                  <el-table-column prop="inspection_date" label="日期" width="110" />
                  <el-table-column prop="inspection_result" label="结果" width="86">
                    <template #default="{ row }">
                      <el-tag size="small" :type="resultTagType(row.inspection_result)">
                        {{ resultLabel(row.inspection_result) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="unqualified_items" label="问题摘要" min-width="160" show-overflow-tooltip />
                  <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                      <el-button
                        v-if="row.source_id && navigationTarget(row)"
                        link
                        type="primary"
                        size="small"
                        @click="openSource(row)"
                      >
                        跳转
                      </el-button>

                      <span v-else-if="row.source_id" class="muted-text">－</span>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane> -->
            </el-tabs>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="importDialogVisible"
      title="批量导入统一社会信用代码"
      width="660px"
      destroy-on-close
      class="credit-import-dialog"
      @closed="resetImportDialog"
    >
      <div class="import-tips">
        按<strong>企业 ID</strong>（整行首列纯数字）或<strong>与库完全一致的企业名称</strong>匹配；
        默认仅填充当前信用代码为空的企业；打开「允许覆盖」可改写已有代码。
      </div>
      <el-form label-width="100px" class="import-form-row">
        <el-form-item label="允许覆盖">
          <el-switch v-model="importOverwrite" />
          <span class="import-switch-hint">关闭时将跳过已有信用代码的记录</span>
        </el-form-item>
      </el-form>

      <el-tabs v-model="importActiveTab" class="import-tabs">
        <el-tab-pane label="键值对粘贴" name="paste">
          <el-input
            v-model="pasteImportText"
            type="textarea"
            :rows="9"
            placeholder="每行一条，Tab 或 英文逗号/分号分隔：&#10;152	91110000MA0123456X &#10;某化妆品有限公司	91110000MA0123456X &#10;152,91110000MA0123456X"
          />
          <div class="import-parse-row">
            <el-button size="small" type="primary" plain @click="parsePasteImport">解析预览</el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Excel" name="excel">
          <p class="excel-hint">
            推荐表头含「统一社会信用代码」及「企业ID」或「企业名称」。无匹配表头时按 A 列键、B 列代码读取全部行。
          </p>
          <input ref="excelInputRef" type="file" accept=".xlsx,.xls" class="hidden-file-input" @change="onExcelImportChange" />
          <el-button size="small" @click="triggerExcelPick">选择 Excel…</el-button>
        </el-tab-pane>
      </el-tabs>

      <template v-if="importPreview.length">
        <div class="preview-caption">待提交 {{ importPreview.length }} 条</div>
        <el-table :data="importPreview.slice(0, 150)" border stripe size="small" max-height="240">
          <el-table-column label="匹配方式" width="88">
            <template #default="{ row }">{{ row.id != null ? 'ID' : '名称' }}</template>
          </el-table-column>
          <el-table-column label="匹配键" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.id != null ? row.id : row.name }}</template>
          </el-table-column>
          <el-table-column prop="credit_code" label="信用代码" min-width="130" show-overflow-tooltip />
        </el-table>
        <p v-if="importPreview.length > 150" class="preview-more">表格仅预览前 150 条；提交仍会处理全部条目（单次最多 3000 条）。</p>
      </template>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importSubmitting" :disabled="!importPreview.length" @click="submitCreditImport">
          提交导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import { getCompanies, getCompanyDetail, updateCompany, bulkImportCompanyCreditCodes } from '@/api/index'
import { currentUser, MODULE_PERMISSIONS } from '@/utils/auth'

const router = useRouter()

function routeModuleForSource(sourceType) {
  const map = { announcement: 'announcements', inspection: 'inspections', supervision: 'supervisions' }
  return map[sourceType] || ''
}

function userCanNavigateTo(moduleKey) {
  if (!moduleKey) return false
  const mods = MODULE_PERMISSIONS[currentUser.value?.role] || []
  return mods.includes(moduleKey)
}

const listLoading = ref(false)
const detailLoading = ref(false)
const saving = ref(false)
const listRows = ref([])
const selectedId = ref(null)
const detail = ref(null)
const activeTab = ref('basic')
const formRef = ref(null)

const filters = reactive({
  name: '',
  credit_code: '',
  credit_code_empty: false
})

const importDialogVisible = ref(false)
const importActiveTab = ref('paste')
const pasteImportText = ref('')
const importOverwrite = ref(false)
const importPreview = ref([])
const importSubmitting = ref(false)
const excelInputRef = ref(null)

const USCC_RE = /^[0-9A-HJ-NPQRTUWXY]{18}$/i
/** 日本 法人番号（13 位数字） */
const JP_CORP_NUM_RE = /^\d{13}$/

function normalizeUsEinDigits(s) {
  const compact = String(s || '').replace(/\s/g, '').replace(/-/g, '')
  return /^\d{9}$/.test(compact) ? compact : null
}

function creditCodeAcceptedMessage() {
  return '须为中国 18 位统一社会信用代码、日本 13 位法人番号、或美国 9 位 EIN（可含连字符）'
}

function parseKeyValuePasteText(text) {
  const out = []
  const lines = String(text).split(/\r?\n/)
  for (const lineRaw of lines) {
    const line = lineRaw.trim()
    if (!line) continue
    let key
    let codePart
    if (line.includes('\t')) {
      const p = line.split('\t').map((s) => s.trim())
      key = p[0]
      codePart = p.slice(1).join('').replace(/\s/g, '')
    } else if (/[,，;；|｜]/.test(line)) {
      const parts = line.split(/[,，;；|｜]/).map((s) => s.trim()).filter(Boolean)
      if (parts.length < 2) continue
      key = parts[0]
      codePart = parts.slice(1).join('').replace(/\s/g, '')
    } else {
      continue
    }
    if (!key || !codePart) continue
    const keyStr = String(key).trim()
    const idTry = Number.parseInt(keyStr, 10)
    if (Number.isFinite(idTry) && idTry > 0 && String(idTry) === keyStr) {
      out.push({ id: idTry, credit_code: codePart })
    } else {
      out.push({ name: keyStr, credit_code: codePart })
    }
  }
  return out
}

function matrixToImportItems(matrix) {
  const items = []
  if (!Array.isArray(matrix) || matrix.length === 0) return items

  const firstRow = (matrix[0] || []).map((c) => String(c ?? '').trim())
  const looksHeader = firstRow.some((cell) => /企业|名称|信用|代码|统一|^id$/i.test(cell))

  if (!looksHeader) {
    for (let r = 0; r < matrix.length; r += 1) {
      const row = matrix[r] || []
      const a = String(row[0] ?? '').trim()
      const code = String(row[1] ?? '').trim().replace(/\s/g, '')
      if (!code) continue
      const idNum = Number.parseInt(a, 10)
      if (Number.isFinite(idNum) && idNum > 0 && String(idNum) === a) {
        items.push({ id: idNum, credit_code: code })
      } else if (a) {
        items.push({ name: a, credit_code: code })
      }
    }
    return items
  }

  let idCol = -1
  let nameCol = -1
  let codeCol = -1
  firstRow.forEach((h, idx) => {
    if (/^(企业)?id$/i.test(h) || /^id$/i.test(h)) idCol = idx
    else if (
      (/企业名称|公司名称/.test(h) || (h.includes('名称') && !/信用|代码/.test(h))) &&
      nameCol < 0
    ) {
      nameCol = idx
    } else if (/统一社会信用|社会信用代码|信用代码/.test(h)) codeCol = idx
  })
  if (codeCol < 0) {
    codeCol = firstRow.length > 1 ? 1 : -1
  }
  if (codeCol < 0) return items
  if (idCol < 0 && nameCol < 0) nameCol = 0

  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r] || []
    const codeRaw = String(row[codeCol] ?? '').trim().replace(/\s/g, '')
    if (!codeRaw) continue
    if (idCol >= 0) {
      const idStr = String(row[idCol] ?? '').trim()
      const idNum = Number.parseInt(idStr, 10)
      if (Number.isFinite(idNum) && idNum > 0) {
        items.push({ id: idNum, credit_code: codeRaw })
        continue
      }
    }
    if (nameCol >= 0) {
      const nm = String(row[nameCol] ?? '').trim()
      if (nm) items.push({ name: nm, credit_code: codeRaw })
    }
  }
  return items
}

function parsePasteImport() {
  importPreview.value = parseKeyValuePasteText(pasteImportText.value)
  if (!importPreview.value.length) {
    ElMessage.warning('未解析到有效行，请使用 Tab 或逗号分隔键与信用代码')
  } else {
    ElMessage.success(`已解析 ${importPreview.value.length} 条，请核对后提交`)
  }
}

function openImportDialog() {
  importDialogVisible.value = true
}

function resetImportDialog() {
  pasteImportText.value = ''
  importPreview.value = []
  importOverwrite.value = false
  importActiveTab.value = 'paste'
  importSubmitting.value = false
}

function triggerExcelPick() {
  excelInputRef.value?.click?.()
}

async function onExcelImportChange(ev) {
  const file = ev.target?.files?.[0]
  if (excelInputRef.value) excelInputRef.value.value = ''
  if (!file) return
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
    importPreview.value = matrixToImportItems(matrix)
    if (!importPreview.value.length) {
      ElMessage.warning('表中未解析到有效数据，请检查表头或列顺序')
    } else {
      ElMessage.success(`已解析 ${importPreview.value.length} 条`)
    }
  } catch {
    ElMessage.error('读取 Excel 失败')
  }
}

async function submitCreditImport() {
  if (!importPreview.value.length) return
  importSubmitting.value = true
  try {
    const res = await bulkImportCompanyCreditCodes({
      items: importPreview.value,
      overwrite: importOverwrite.value
    })
    
    const { updated = [], skipped = [], failed = [] } = res?.data || {}
    const summary =
      typeof res?.message === 'string'
        ? res.message
        : `成功 ${updated.length}，跳过 ${skipped.length}，失败 ${failed.length}`
    ElMessage.success(summary)
    if (failed.length) {
      ElMessage.warning(
        `失败 ${failed.length} 条，尝试使用手动输入`
      )
    }
    importPreview.value = []
    pasteImportText.value = ''
    importDialogVisible.value = false
    pagination.page = 1
    await loadList()
    if (selectedId.value) await reloadDetail()
  } catch (e) {
    console.log(e);
    
    const msg = e?.response?.data?.message || e?.message || '导入失败'
    ElMessage.error(msg)

  } finally {
    importSubmitting.value = false
  }
}

function onCreditEmptyChange() {
  pagination.page = 1
  loadList()
}

function companyTypeLabel(type) {
  const m = { manufacturer: '生产企业', distributor: '经销商', seller: '销售商' }
  return m[type] || type || '-'
}

function formatDbTime(v) {
  if (v == null || v === '') return '-'
  const d = typeof v === 'string' ? new Date(v.replace(' ', 'T')) : new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString()
}

function getCityName(fullAddress) {
  if (!fullAddress) return ''
  // 正则匹配：xx市
  const match = fullAddress.match(/[^省]+市/)
  return match ? match[0] : ''
}

function validateCreditCode(_rule, value, callback) {
  const s = String(value || '').replace(/\s/g, '')
  if (!s) {
    callback()
    return
  }
  if (USCC_RE.test(s)) {
    callback()
    return
  }
  if (JP_CORP_NUM_RE.test(s)) {
    callback()
    return
  }
  if (normalizeUsEinDigits(s)) {
    callback()
    return
  }
  callback(new Error(creditCodeAcceptedMessage()))
}

const pagination = reactive({
  page: 1,
  limit: 14,
  total: 0
})

const editForm = reactive({
  name: '',
  credit_code: '',
  brand: '',
  type: 'manufacturer',
  province: '',
  city: '',
  address: '',
  product_category: ''
})

function applyCompanyToForm(company = {}) {
  editForm.name = company.name || ''
  editForm.credit_code = company.credit_code || ''
  editForm.brand = company.brand ?? ''
  editForm.type = company.type || 'manufacturer'
  editForm.province = company.province ?? ''
  editForm.city = getCityName(company.address) ?? ''
  editForm.address = company.address ?? ''
  editForm.product_category = company.product_category ?? ''
}

function normalizeListRes(res) {
  const rows = Array.isArray(res?.data) ? res.data : []
  const total = Number(res?.pagination?.total ?? 0)
  return { rows, total }
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await getCompanies({
      name: filters.name || undefined,
      credit_code: filters.credit_code?.trim() || undefined,
      credit_code_empty: filters.credit_code_empty ? 'true' : undefined,
      page: pagination.page,
      limit: pagination.limit
    })
    const { rows, total } = normalizeListRes(res)
    listRows.value = rows
    pagination.total = total
    if (
      selectedId.value &&
      !rows.some((r) => Number(r.id) === Number(selectedId.value))
    ) {
      // 当前选中项已不在本页，保留选中并尝试加载详情仍可工作
    }
  } finally {
    listLoading.value = false
  }
}

function onPageChange(p) {
  pagination.page = p
  loadList()
}

function resetListFilters() {
  filters.name = ''
  filters.credit_code = ''
  filters.credit_code_empty = false
  pagination.page = 1
  loadList()
}

async function loadDetail(id) {
  if (!id) return
  detailLoading.value = true
  try {
    const res = await getCompanyDetail(id, { include_history: 0 })
    detail.value = res?.data ?? null
    if (detail.value?.company) {
      applyCompanyToForm(detail.value.company)
      formRef.value?.clearValidate?.()
    }
  } catch {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

function reloadDetail() {
  return loadDetail(selectedId.value)
}

function handleRowClick(row) {
  if (!row?.id) return
  selectedId.value = row.id
}

watch(selectedId, (id) => {
  if (!id) {
    detail.value = null
    return
  }
  activeTab.value = 'basic'
  loadDetail(id)
})

async function saveBasic() {
  if (!selectedId.value) return
  const ok = await formRef.value?.validate?.().catch(() => false)
  if (!ok) return
  saving.value = true
  try {
    const trimmed = String(editForm.credit_code || '').trim()
    const codeNoSpace = trimmed.replace(/\s/g, '')
    let creditPayload = null
    if (codeNoSpace) {
      if (USCC_RE.test(codeNoSpace)) {
        creditPayload = codeNoSpace.toUpperCase()
      } else if (JP_CORP_NUM_RE.test(codeNoSpace)) {
        creditPayload = codeNoSpace
      } else {
        creditPayload = normalizeUsEinDigits(codeNoSpace)
      }
    }

    await updateCompany(selectedId.value, {
      name: editForm.name.trim(),
      credit_code: creditPayload,
      brand: editForm.brand?.trim() || null,
      type: editForm.type,
      province: editForm.province?.trim() || null,
      city: editForm.city?.trim() || null,
      address: editForm.address?.trim() || null,
      product_category: editForm.product_category?.trim() || null
    })
    ElMessage.success('企业主档已保存')
    await loadList()
    await reloadDetail()
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || '保存失败'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}

function sourceTypeLabel(t) {
  const map = { announcement: '抽检通告', inspection: '抽样检查', supervision: '飞行检查' }
  return map[t] || t || '-'
}

function resultTagType(v) {
  const map = { qualified: 'success', unqualified: 'danger', pending: 'info' }
  return map[v] || 'info'
}

function resultLabel(v) {
  const map = { qualified: '合格', unqualified: '不合格', pending: '待定' }
  return map[v] || v || '-'
}

function navigationTarget(row) {
  const mod = routeModuleForSource(row.source_type)
  return mod && userCanNavigateTo(mod)
}

function openSource(row) {
  const id = row.source_id
  if (!id) return
  const mod = routeModuleForSource(row.source_type)
  if (!userCanNavigateTo(mod)) {
    ElMessage.warning('当前账号暂无该来源模块的菜单权限')
    return
  }
  if (row.source_type === 'announcement') router.push(`/announcements/${id}`)
  else if (row.source_type === 'inspection') router.push(`/inspections/${id}`)
  else if (row.source_type === 'supervision') router.push(`/supervisions/${id}`)
}

loadList()
</script>

<style scoped>
.companies-manage {
  max-width: 1600px;
  margin: 0 auto;
}

.layout-row {
  align-items: stretch;
}

.left-col,
.right-col {
  min-width: 0;
}

.list-card,
.detail-card {
  min-height: 360px;
}

.card-title {
  font-weight: 600;
}

.filter-form {
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.list-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.import-tips {
  font-size: 13px;
  color: #606266;
  line-height: 1.55;
  margin-bottom: 12px;
}

.import-form-row {
  margin-bottom: 8px;
}

.import-switch-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.import-tabs {
  margin-top: 8px;
}

.import-parse-row {
  margin-top: 8px;
}

.excel-hint {
  font-size: 12px;
  color: #909399;
  margin: 0 0 8px;
  line-height: 1.5;
}

.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.preview-caption {
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 500;
}

.preview-more {
  font-size: 12px;
  color: #909399;
  margin: 6px 0 0;
}

.list-pagination {
  margin-top: 12px;
  justify-content: center;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.detail-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.stats-block {
  margin-bottom: 8px;
}

.company-master-block {
  margin-top: 16px;
  margin-bottom: 8px;
}

.stats-hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 16px;
  line-height: 1.5;
}

.edit-form {
  max-width: 720px;
}

.muted-text {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
