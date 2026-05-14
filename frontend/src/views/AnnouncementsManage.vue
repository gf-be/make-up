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
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 130px" @change="applyFilters">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
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
        <el-form-item label="涉及地区">
          <el-input v-model="filters.location" clearable placeholder="省份/地区" style="width: 150px" @keyup.enter="applyFilters" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="标题、编号、内容、检验单位" style="width: 240px" @keyup.enter="applyFilters" />
        </el-form-item>
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
      <el-card shadow="never" class="list-card">
        <template #header>
          <div class="panel-header">
            <span>通告列表</span>
            <el-tag type="info" effect="plain">共 {{ pagination.total }} 条</el-tag>
          </div>
        </template>

        <el-table
          v-loading="loading"
          :data="announcementRows"
          row-key="id"
          stripe
          highlight-current-row
          empty-text="暂无通告"
          class="announcement-table"
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
          <el-table-column label="产品" width="86" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ getProductTypeLabel(row.product_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="inspection_count" label="批次" width="72" align="center" />
        </el-table>

        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          small
          background
          class="pagination"
          @size-change="handlePageSizeChange"
          @current-change="loadAnnouncements"
        />
      </el-card>

      <div class="detail-pane">
        <div v-if="selectedAnnouncement" class="detail-toolbar">
          <div class="selected-title">{{ selectedAnnouncement.title || '通告详情' }}</div>
        </div>
        <AnnouncementDetail :announcement-id="selectedAnnouncementId" embedded />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import AnnouncementDetail from './AnnouncementDetail.vue'
import { getAnnouncements } from '@/api/index'

const PRODUCT_TYPE_LABELS = {
  cosmetics: '化妆品',
  food: '食品',
  medical_device: '医疗器械',
  unknown: '未分类'
}

const productTypeOptions = Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const statusOptions = [
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'archived', label: '已归档' }
]

const loading = ref(false)
const announcementRows = ref([])
const selectedAnnouncementId = ref('')
const filters = reactive({
  product_type: '',
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

loadAnnouncements()
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
  margin-bottom: -12px;
}

.manage-layout {
  display: grid;
  grid-template-columns: minmax(380px, 34%) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.list-card,
.detail-pane {
  min-height: calc(100vh - 230px);
}

.announcement-table {
  width: 100%;
}

.announcement-title {
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.announcement-meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.list-card :deep(.selected-row > td) {
  background-color: #ecf5ff !important;
}

.pagination {
  margin-top: 14px;
  justify-content: flex-end;
}

.detail-pane {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
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

@media (max-width: 1100px) {
  .manage-layout {
    grid-template-columns: 1fr;
  }
}
</style>
