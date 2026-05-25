<template>
  <div class="announcements-manage">
    <el-card shadow="never" class="filter-card">
      <template #header>
        <div class="page-header">
          <div>
            <div class="page-title">通告管理</div>
            <!-- <div class="page-subtitle">筛选通告后，在右侧直接查看详情与问题产品明细</div> -->
          </div>
          <el-button :loading="loading" @click="loadAnnouncements">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="产品类型">
          <el-select v-model="filters.product_type" clearable placeholder="全部产品类型" style="width: 150px" @change="applyFilters">
            <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <!-- <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 130px" @change="applyFilters">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item> -->
        <el-form-item label="年份">
          <el-date-picker
            v-model="filters.year"
            type="year"
            value-format="YYYY"
            placeholder="全部年份"
            clearable
            style="width: 130px"
            @change="applyFilters"
          />
        </el-form-item>
        <!-- <el-form-item label="涉及地区">
          <el-input v-model="filters.location" clearable placeholder="省份/地区" style="width: 150px" @keyup.enter="applyFilters" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="标题、编号、内容、检验单位" style="width: 240px" @keyup.enter="applyFilters" />
        </el-form-item>-->
        <el-form-item> 
          <el-button type="primary" @click="applyFilters">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="manage-layout">
      <div class="manage-columns">
        <div class="list-pane">
          <div class="list-pane-header">
            <span class="list-pane-title">通告列表</span>
          </div>
          <div class="list-pane-body">
            <el-table
              v-loading="loading"
              :data="announcementRows"
              row-key="id"
              stripe
              highlight-current-row
              empty-text="暂无通告"
              class="announcement-table"
              :max-height="announcementListTableMaxHeight"
              :row-class-name="getRowClassName"
              @row-click="selectAnnouncement"
            >
              <el-table-column label="通告信息" min-width="260" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="announcement-title">{{ row.title || '（无标题）' }}</div>
                  <div class="announcement-meta">
                    <span>{{ row.announcement_no || '无编号' }}</span>
                    <span>{{ formatDate(row.publish_date) }}</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>

            <el-pagination
              v-if="announcementPaginationVisible"
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.limit"
              :total="pagination.total"
              :page-sizes="[10, 20]"
              layout="total, sizes, prev, pager, next"
              small
              background
              class="pagination"
              @size-change="handlePageSizeChange"
              @current-change="loadAnnouncements"
            />
          </div>
        </div>

        <div class="detail-pane">
          <div v-if="selectedAnnouncement" class="detail-toolbar">
            <div class="selected-title">{{ selectedAnnouncement.title || '通告详情' }}</div>
          </div>
          <AnnouncementDetail :announcement-id="selectedAnnouncementId" embedded />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import AnnouncementDetail from './AnnouncementDetail.vue'
import { getAnnouncements } from '@/api/index'

const announcementListTableMaxHeight = ref(520)

const PRODUCT_TYPE_LABELS = {
  cosmetics: '化妆品',
  food: '食品',
  medical_device: '医疗器械',
  unknown: '未分类'
}

const productTypeOptions = Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({ value, label }))
// const statusOptions = [
//   { value: 'published', label: '已发布' },
//   { value: 'draft', label: '草稿' },
//   { value: 'archived', label: '已归档' }
// ]

const loading = ref(false)
const announcementRows = ref([])
const selectedAnnouncementId = ref('')
const filters = reactive({
  product_type: PRODUCT_TYPE_LABELS.food,
  status: '',
  year: '',
  location: '',
  keyword: ''
})
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const selectedAnnouncement = computed(() =>
  announcementRows.value.find((row) => String(row.id) === String(selectedAnnouncementId.value)) || null
)

const announcementPaginationVisible = computed(() => Number(pagination.total || 0) >= 10)

function normalizeAnnouncementListResponse(res) {
  const payload = res?.data
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.list) ? payload.list : []
  const total = Number(res?.pagination?.total ?? payload?.total ?? 0)
  return { list, total }
}

function getProductTypeLabel(value) {
  return PRODUCT_TYPE_LABELS[value] || value || '未分类'
}

function formatDate(value) {
  if (!value) return '暂无日期'
  return String(value).slice(0, 10)
}

function selectAnnouncement(row) {
  selectedAnnouncementId.value = row?.id || ''
}

function syncSelectedAnnouncement(list) {
  if (!list.length) {
    selectedAnnouncementId.value = ''
    return
  }

  const hasSelected = list.some((row) => String(row.id) === String(selectedAnnouncementId.value))
  if (!hasSelected) {
    selectedAnnouncementId.value = list[0].id
  }
}

async function loadAnnouncements() {
  loading.value = true
  try {
    const res = await getAnnouncements({
      ...filters,
      page: pagination.page,
      limit: pagination.limit
    })
    const { list, total } = normalizeAnnouncementListResponse(res)
    announcementRows.value = list
    pagination.total = total
    syncSelectedAnnouncement(list)
  } catch (error) {
    console.error('加载通告列表失败:', error)
    announcementRows.value = []
    pagination.total = 0
    selectedAnnouncementId.value = ''
    ElMessage.error('加载通告列表失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  pagination.page = 1
  loadAnnouncements()
}

function resetFilters() {
  filters.product_type = ''
  filters.status = ''
  filters.year = ''
  filters.location = ''
  filters.keyword = ''
  applyFilters()
}

function handlePageSizeChange() {
  pagination.page = 1
  loadAnnouncements()
}

function getRowClassName({ row }) {
  return String(row.id) === String(selectedAnnouncementId.value) ? 'selected-row' : ''
}

function syncAnnouncementListTableMaxHeight() {
  if (typeof window === 'undefined') {
    return
  }
  announcementListTableMaxHeight.value = Math.max(320, Math.min(760, Math.round(window.innerHeight - 280)))
}

syncAnnouncementListTableMaxHeight()
if (typeof window !== 'undefined') {
  window.addEventListener('resize', syncAnnouncementListTableMaxHeight)
}

loadAnnouncements()

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncAnnouncementListTableMaxHeight)
  }
})
</script>

<style scoped>
.announcements-manage {
  max-width: 1760px;
  margin: 0 auto;
  padding: 0 8px;
}

.filter-card {
  margin-bottom: 16px;
}

.page-header,
.panel-header,
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.page-subtitle {
  margin-top: 4px;
  color: #909399;
  font-size: 13px;
}

.filter-form {
  margin-bottom: -8px;
}

.manage-layout {
  min-height: calc(100vh - 230px);
}

.manage-columns {
  display: flex;
  gap: 16px;
  align-items: stretch;
  min-height: calc(100vh - 230px);
}

.list-pane {
  flex: 0 0 380px;
  width: 380px;
  min-height: calc(100vh - 230px);
  display: flex;
  flex-direction: column;
  background: #fcfdff;
  border: 1px solid #edf2f8;
  border-radius: 4px;
  box-shadow: 6px 0 20px rgba(100, 130, 170, 0.06);
  overflow: hidden;
}

.list-pane-header {
  flex-shrink: 0;
  padding: 16px 12px 12px;
  border-bottom: 1px solid #e8eef6;
  background: linear-gradient(180deg, #f8fbff 0%, #f3f7fc 100%);
}

.list-pane-title {
  color: #5b7ea8;
  font-weight: 600;
}

.list-pane-body {
  flex: 1;
  min-height: 0;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-pane {
  flex: 1;
  min-width: 0;
  min-height: calc(100vh - 230px);
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.announcement-table {
  width: 100%;
}

.announcement-table :deep(.el-table__header-wrapper th.el-table__cell) {
  background: #f7faff !important;
  color: #7a94b8;
  border-bottom-color: #edf2f8 !important;
}

.announcement-table :deep(.el-table__body tr > td.el-table__cell) {
  border-bottom-color: #f3f6fb;
  color: #5f6f82;
}

.announcement-table :deep(.el-table__body tr.el-table__row--striped > td.el-table__cell) {
  background: #fcfdff;
}

.announcement-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #f6f9fd !important;
}

.announcement-title {
  font-weight: 600;
  color: #5b7ea8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid #eef4fb;
}

.announcement-meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  color: #9eb3cc;
  font-size: 12px;
}

.announcement-table :deep(.selected-row > td) {
  background-color: #f1f6fc !important;
  color: #5b7ea8 !important;
  box-shadow: inset 3px 0 0 #a8c4e8;
}

.pagination {
  margin-top: 14px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.detail-toolbar {
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}

.selected-title {
  min-width: 0;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
