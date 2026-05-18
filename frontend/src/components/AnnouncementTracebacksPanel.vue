<template>
  <div class="tracebacks-panel-root">
    <el-alert
      v-if="pinnedTracebackId"
      type="info"
      :closable="false"
      show-icon
      class="mb-16"
      :title="`当前已按倒溯记录 #${pinnedTracebackId} 精确定位，可清空筛选查看完整列表。`"
    />

   

    <el-form :model="filters" inline class="filter-form">
      <el-form-item label="状态">
        <el-select v-model="filters.handled_status" clearable placeholder="全部状态" style="width: 150px">
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="resolved" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="filters.trace_type" clearable placeholder="全部类型" style="width: 170px">
          <el-option label="重复导入" value="duplicate" />
          <el-option label="解析失败" value="parse_failed" />
          <el-option label="导入异常" value="import_failed" />
          <el-option label="已导入有误" value="published_incorrect" />
          <el-option label="核验打回" value="manual_reject" />
        </el-select>
      </el-form-item>
      <el-form-item label="产品类型">
        <el-select v-model="filters.product_type" clearable placeholder="全部产品类型" style="width: 150px">
          <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="标题 / 原因 / 网址 / 来源用户"
          style="width: 320px"
          @keyup.enter="loadTracebacks"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadTracebacks">搜索</el-button>
        <el-button @click="resetFilters">清空筛选</el-button>
      </el-form-item>
    </el-form>

    <div class="list-meta-row mb-16">
      <span>当前展示 {{ tracebacks.length }} 条倒溯记录</span>
      <div class="bulk-actions">
        <el-button
          v-if="selectedTracebackIds.length > 0"
          type="danger"
          :loading="batchDeleting"
          @click="handleBatchDelete"
        >
          <el-icon><Delete /></el-icon>
          批量删除 ({{ selectedTracebackIds.length }})
        </el-button>
        <span v-else>删除后会同步清理临时区相关数据，便于再次导入不报重复</span>
      </div>
    </div>

    <el-table
      ref="tableRef"
      :data="tracebacks"
      size="small"
      stripe
      border
      v-loading="loading"
      max-height="720"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="类型" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="getTraceTypeTagType(row.trace_type)">{{ row.trace_type_label || row.trace_type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="通告标题" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="title-cell">
            <div class="title-main">{{ row.title || '-' }}</div>
            <div class="title-sub">
              {{ row.product_type_label || '-' }} / {{ row.announcement_type_label || '-' }}
              <span v-if="row.announcement_no"> · {{ row.announcement_no }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="临时批次" width="100" align="center" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.existing_batch_id != null && row.existing_batch_id !== '' ? row.existing_batch_id : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="来源用户" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ getSourceUserLabel(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="280" show-overflow-tooltip />
      <el-table-column prop="created_at" label="创建时间" width="170" align="center" />
      <el-table-column prop="updated_at" label="更新时间" width="170" align="center" />
      <el-table-column label="通告网址" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          <a v-if="row.source_detail_url" :href="row.source_detail_url" target="_blank" rel="noreferrer">{{ row.source_detail_url }}</a>
          <span v-else class="muted-text">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.handled_status === 'resolved' ? 'success' : 'warning'">
            {{ row.handled_status === 'resolved' ? '已处理' : '待处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="280" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button v-if="row.source_detail_url" link type="primary" @click="openSourceUrl(row.source_detail_url)">查看网址</el-button>
            <el-button v-if="row.existing_batch_id" link type="primary" @click="goToStagingBatch(row.existing_batch_id)">定位批次</el-button>
            <el-button v-if="row.existing_announcement_id || row.existing_supervision_id" link type="success" @click="goToPublished(row)">查看正式稿</el-button>
            <!-- <el-button v-if="row.handled_status !== 'resolved'" link type="warning" @click="handleResolveTraceback(row)">标记已处理</el-button> -->
            <el-button link type="danger" @click="handleDeleteTraceback(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Delete } from '@element-plus/icons-vue'
import {
  deleteAnnouncementStagingTraceback,
  getAnnouncementStagingOverview,
  getAnnouncementStagingTracebacks,
  getAnnouncementStagingWorkspaceCache,
  resolveAnnouncementStagingTraceback,
  saveAnnouncementStagingWorkspaceCache
} from '@/api/index'

const TRACEBACK_CACHE_KEY = 'announcement-tracebacks-workspace'

const productTypeOptions = [
  { label: '化妆品', value: 'cosmetics' },
  { label: '食品', value: 'food' },
  { label: '医疗器械', value: 'medical_device' },
  { label: '未知', value: 'unknown' }
]

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const overviewLoading = ref(false)
const workspaceCacheReady = ref(false)
const tracebacks = ref([])
const pinnedTracebackId = ref('')
const routeSyncReady = ref(false)
const tableRef = ref(null)
const selectedTracebackIds = ref([])
const batchDeleting = ref(false)

let workspaceSaveTimer = null

const filters = reactive({
  handled_status: 'pending',
  trace_type: '',
  product_type: '',
  keyword: ''
})

const overview = reactive(createEmptyOverview())

function createEmptyOverview() {
  return {
    traceback_count: 0,
    pending_traceback_count: 0,
    resolved_traceback_count: 0,
    duplicate_traceback_count: 0,
    parse_failed_traceback_count: 0,
    import_failed_traceback_count: 0,
    published_incorrect_traceback_count: 0,
    manual_reject_traceback_count: 0
  }
}

function safeQueryValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim()
  }
  return String(value || '').trim()
}

function getTraceTypeTagType(traceType) {
  if (traceType === 'parse_failed') return 'danger'
  if (traceType === 'import_failed') return 'info'
  if (traceType === 'manual_reject') return 'warning'
  return 'warning'
}

function getJsonFileName(filePath) {
  const normalized = String(filePath || '').trim()
  if (!normalized) return '-'
  return normalized.split(/[\\/]/).pop() || normalized
}

function getSourceUserLabel(row = {}) {
  return row.imported_by_username || row.uploaded_by_username || row.created_by_username || row.username || getJsonFileName(row.source_json_file)
}

function buildWorkspacePayload() {
  return {
    filters: { ...filters },
    pinnedTracebackId: pinnedTracebackId.value
  }
}

function applyWorkspacePayload(payload = {}) {
  const nextFilters = payload.filters || {}
  filters.handled_status = nextFilters.handled_status ?? 'pending'
  filters.trace_type = nextFilters.trace_type ?? ''
  filters.product_type = nextFilters.product_type ?? ''
  filters.keyword = nextFilters.keyword ?? ''
  pinnedTracebackId.value = payload.pinnedTracebackId ? String(payload.pinnedTracebackId) : ''
}

function applyRouteQuery(query = route.query) {
  const nextTracebackId = safeQueryValue(query.tracebackId || query.id)
  const nextKeyword = safeQueryValue(query.keyword)
  const nextTraceType = safeQueryValue(query.trace_type)
  const nextHandledStatus = safeQueryValue(query.handled_status)

  if (nextTracebackId) {
    pinnedTracebackId.value = nextTracebackId
    filters.handled_status = nextHandledStatus || ''
  }

  if (nextKeyword) {
    filters.keyword = nextKeyword
  }

  if (nextTraceType) {
    filters.trace_type = nextTraceType
  }
}

async function saveWorkspaceCacheNow() {
  if (!workspaceCacheReady.value) {
    return
  }

  try {
    await saveAnnouncementStagingWorkspaceCache({
      cache_key: TRACEBACK_CACHE_KEY,
      payload: buildWorkspacePayload()
    })
  } catch (error) {
    console.error('保存倒溯处理工作区缓存失败:', error)
  }
}

function scheduleWorkspaceSave() {
  if (workspaceSaveTimer) {
    clearTimeout(workspaceSaveTimer)
  }

  workspaceSaveTimer = setTimeout(() => {
    saveWorkspaceCacheNow()
  }, 400)
}

async function loadWorkspaceCache() {
  try {
    const res = await getAnnouncementStagingWorkspaceCache({ cache_key: TRACEBACK_CACHE_KEY })
    return res.data?.payload || {}
  } catch (error) {
    console.error('读取倒溯处理工作区缓存失败:', error)
    return {}
  }
}

async function loadOverview() {
  overviewLoading.value = true
  try {
    const res = await getAnnouncementStagingOverview()
    Object.assign(overview, createEmptyOverview(), res.data || {})
  } catch (error) {
    console.error('加载倒溯统计失败:', error)
  } finally {
    overviewLoading.value = false
  }
}

async function loadTracebacks() {
  loading.value = true
  try {
    const res = await getAnnouncementStagingTracebacks({
      id: pinnedTracebackId.value || undefined,
      ...filters,
      limit: 200
    })
    tracebacks.value = res.data || []
  } catch (error) {
    console.error('加载倒溯列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadOverview(), loadTracebacks()])
}

function openSourceUrl(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function goToStagingBatch(batchId) {
  if (!batchId) return
  const stagingPath = '/announcement-staging'
  const q = { ...route.query, view: 'review', focusBatchId: String(batchId) }
  delete q.tracebackId
  delete q.id
  router.replace({ path: stagingPath, query: q })
}

function goToPublished(row = {}) {
  if (row.existing_supervision_id) {
    router.push(`/supervisions/${row.existing_supervision_id}`)
    return
  }

  if (row.existing_announcement_id) {
    router.push(`/announcements/${row.existing_announcement_id}`)
  }
}

function tracebackQueryCleanup() {
  const q = { ...route.query }
  delete q.tracebackId
  delete q.id
  return q
}

function resetFilters() {
  filters.handled_status = 'pending'
  filters.trace_type = ''
  filters.product_type = ''
  filters.keyword = ''
  pinnedTracebackId.value = ''
  router.replace({ path: route.path, query: tracebackQueryCleanup() })
  loadTracebacks()
}

async function handleResolveTraceback(row) {
  if (!row?.id || row.handled_status === 'resolved') {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认将"${row.title || '该记录'}"标记为已处理吗？`,
      '标记倒溯处理完成',
      {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }
    )

    await resolveAnnouncementStagingTraceback(row.id)
    ElMessage.success('倒溯记录已标记为已处理')
    await refreshAll()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('标记倒溯记录失败:', error)
  }
}

async function handleDeleteTraceback(row) {
  if (!row?.id) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除"${row.title || '该记录'}"这条倒溯记录吗？删除后将无法恢复。`,
      '删除倒溯记录',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    )

    await deleteAnnouncementStagingTraceback(row.id)
    ElMessage.success('倒溯记录已删除')

    if (String(pinnedTracebackId.value || '') === String(row.id)) {
      pinnedTracebackId.value = ''
      router.replace({ path: route.path, query: tracebackQueryCleanup() })
    }

    await refreshAll()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('删除倒溯记录失败:', error)
  }
}

function handleSelectionChange(selection) {
  selectedTracebackIds.value = selection.map((item) => item.id)
}

async function handleBatchDelete() {
  if (selectedTracebackIds.value.length === 0 || batchDeleting.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认批量删除选中的 ${selectedTracebackIds.value.length} 条倒溯记录吗？删除后将无法恢复。`,
      '批量删除倒溯记录',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: true
      }
    )

    batchDeleting.value = true
    const deletePromises = selectedTracebackIds.value.map((id) => deleteAnnouncementStagingTraceback(id))

    try {
      await Promise.all(deletePromises)
      ElMessage.success(`成功删除 ${selectedTracebackIds.value.length} 条倒溯记录`)

      const pinnedDeleted = selectedTracebackIds.value.some((id) => String(id) === String(pinnedTracebackId.value))
      if (pinnedDeleted) {
        pinnedTracebackId.value = ''
        router.replace({ path: route.path, query: tracebackQueryCleanup() })
      }

      selectedTracebackIds.value = []
      await refreshAll()
    } catch (error) {
      console.error('批量删除失败:', error)
      throw error
    }
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('批量删除倒溯记录失败:', error)
  } finally {
    batchDeleting.value = false
  }
}

watch(
  [filters, pinnedTracebackId],
  () => {
    scheduleWorkspaceSave()
  },
  { deep: true }
)

watch(
  () => route.fullPath,
  async () => {
    if (!routeSyncReady.value) {
      return
    }
    if (route.path !== '/announcement-staging') {
      return
    }
    const view = safeQueryValue(route.query.view)
    if (view !== 'traceback') {
      return
    }
    applyRouteQuery(route.query)
    await refreshAll()
  }
)

onMounted(async () => {
  const cachePayload = await loadWorkspaceCache()
  applyWorkspacePayload(cachePayload)

  const view = safeQueryValue(route.query.view)
  if (route.path === '/announcement-staging' && view === 'traceback') {
    applyRouteQuery(route.query)
  }

  await refreshAll()
  workspaceCacheReady.value = true
  routeSyncReady.value = true
})

onBeforeUnmount(() => {
  if (workspaceSaveTimer) {
    clearTimeout(workspaceSaveTimer)
    workspaceSaveTimer = null
  }
})

defineExpose({ refreshAll })
</script>

<style scoped>
.tracebacks-panel-root {
  min-width: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 18px 20px;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e5e7eb;
}

.stat-card.primary {
  background: linear-gradient(135deg, #eef6ff 0%, #dbeafe 100%);
}

.stat-card.warning {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
}

.stat-card.danger {
  background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
}

.stat-card.info {
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
}

.stat-card.success {
  background: linear-gradient(135deg, #eefbf3 0%, #dbf5e5 100%);
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

.stat-value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
  color: #111827;
}

.stat-meta {
  margin-top: 6px;
  font-size: 13px;
  color: #6b7280;
}

.filter-form {
  margin-bottom: 12px;
}

.list-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-main {
  color: #111827;
  font-weight: 600;
}

.title-sub {
  color: #6b7280;
  font-size: 12px;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
}

.muted-text {
  color: #9ca3af;
}

.mb-16 {
  margin-bottom: 16px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .list-meta-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .bulk-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
