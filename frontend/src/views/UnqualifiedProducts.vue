<template>
  <div class="unqualified-products">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="page-title">不合格产品 / 飞检问题项</div>
            <div class="page-subtitle">支持按企业、来源通告、时间、产品分类和问题项目筛选，并可直接跳转到产品详情、来源通告与企业详情。</div>
          </div>
          <el-tag type="danger" size="large">当前命中 {{ summary.matched_count || 0 }} 条</el-tag>
        </div>
      </template>

      <el-alert
        v-if="summary.batch_title"
        type="warning"
        :closable="false"
        show-icon
        class="mb-20"
        :title="`${summary.batch_title}（当前已录入 ${summary.loaded_count} 条）`"
      />

      <el-form :model="filters" class="filter-form" label-width="96px">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="综合关键词">
              <el-input
                v-model="filters.keyword"
                placeholder="搜索产品、企业、机构、标题"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="企业关键词">
              <el-input
                v-model="filters.company_keyword"
                placeholder="搜索企业或被抽样单位"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="来源通告">
              <el-input
                v-model="filters.source_keyword"
                placeholder="搜索通告/飞检标题"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="项目关键词">
              <el-input
                v-model="filters.unqualified_item"
                placeholder="如：菌落总数、甲硝唑"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="不符合项目">
              <el-select
                v-model="filters.issue_items"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                clearable
                placeholder="选择一个或多个项目"
                style="width: 100%"
              >
                <el-option
                  v-for="item in filterOptions.issue_items"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="产品分类">
              <el-select v-model="filters.product_category" clearable filterable placeholder="全部分类" style="width: 100%">
                <el-option v-for="item in filterOptions.product_categories" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="产品类型">
              <el-select v-model="filters.product_type" clearable placeholder="全部产品类型" style="width: 100%">
                <el-option v-for="item in filterOptions.product_types" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="通告类型">
              <el-select v-model="filters.announcement_type" clearable placeholder="全部通告类型" style="width: 100%">
                <el-option v-for="item in filterOptions.announcement_types" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="所在省份">
              <el-select v-model="filters.province" clearable filterable placeholder="全部省份" style="width: 100%">
                <el-option v-for="item in filterOptions.provinces" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="4">
            <el-form-item label="年份">
              <el-select v-model="filters.year" clearable filterable placeholder="全部年份" style="width: 100%">
                <el-option v-for="item in filterOptions.years" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="20">
            <div class="filter-actions">
              <el-button type="primary" @click="handleSearch">搜索</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </div>
          </el-col>
        </el-row>
      </el-form>

      <el-alert
        v-if="hasActiveFilters"
        type="info"
        :closable="false"
        show-icon
        class="mb-20"
        :title="`当前检索条件命中 ${summary.matched_count || 0} 条结果`"
      />

      <div class="result-summary mb-20">
        <el-tag type="danger" effect="dark">命中 {{ summary.matched_count || 0 }} 条</el-tag>
        <el-tag type="info">当前页 {{ summary.current_page_count || tableData.length || 0 }} 条</el-tag>
        <el-tag type="success">涉及省份 {{ summary.province_count || 0 }} 个</el-tag>
        <el-tag v-if="filters.year" type="warning">年份：{{ filters.year }}年</el-tag>
        <el-tag v-if="filters.announcement_id" type="warning">已锁定来源通告</el-tag>
        <el-tag v-if="filters.supervision_id" type="warning">已锁定飞检通告</el-tag>
      </div>

      <el-row :gutter="16" class="stats-row">
        <el-col :span="6">
          <div class="stat-card danger">
            <div class="stat-value">{{ stats.loaded_count || 0 }}</div>
            <div class="stat-label">已录入条目</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card primary">
            <div class="stat-value">{{ stats.source_count || 0 }}</div>
            <div class="stat-label">来源通告数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card success">
            <div class="stat-value">{{ stats.company_count || 0 }}</div>
            <div class="stat-label">涉及企业数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card warning">
            <div class="stat-value">{{ stats.issue_item_count || 0 }}</div>
            <div class="stat-label">可筛选问题项</div>
          </div>
        </el-col>
      </el-row>

      <el-table :data="tableData" stripe border v-loading="loading" max-height="720">
        <el-table-column type="expand" width="50">
          <template #default="{ row }">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="来源标题">{{ row.source_title || row.batch_title || '-' }}</el-descriptions-item>
              <el-descriptions-item label="来源日期">{{ row.source_publish_date || '-' }}</el-descriptions-item>
              <el-descriptions-item label="产品类型">{{ row.product_type_label || '-' }}</el-descriptions-item>
              <el-descriptions-item label="通告类型">{{ row.announcement_type_label || '-' }}</el-descriptions-item>
              <el-descriptions-item label="企业地址">{{ row.company_addresses || '-' }}</el-descriptions-item>
              <el-descriptions-item label="被抽样单位地址">{{ row.sample_unit_address || '-' }}</el-descriptions-item>
              <el-descriptions-item label="包装规格">{{ row.package_spec || '-' }}</el-descriptions-item>
              <el-descriptions-item label="标示批号">{{ row.batch_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="标示生产日期">{{ row.production_date || '-' }}</el-descriptions-item>
              <el-descriptions-item label="限期使用日期/保质期">{{ row.expiry_date || '-' }}</el-descriptions-item>
              <el-descriptions-item label="所在地/进口地区">{{ row.product_region || '-' }}</el-descriptions-item>
              <el-descriptions-item label="生产企业省份">{{ row.manufacturer_province || '-' }}</el-descriptions-item>
              <el-descriptions-item label="抽样单位省份">{{ row.sampled_province || '-' }}</el-descriptions-item>
              <el-descriptions-item label="注册/备案编号">{{ row.registration_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="生产许可证号">{{ row.production_license_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="问题类型">{{ row.issue_category || '-' }}</el-descriptions-item>
              <el-descriptions-item label="产品分类">{{ row.product_category || '-' }}</el-descriptions-item>
              <el-descriptions-item label="检验结果/处理措施" :span="2">{{ row.inspection_result || '-' }}</el-descriptions-item>
              <el-descriptions-item label="依据/规定要求" :span="2">{{ row.requirement || '-' }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">{{ row.remarks || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>
        </el-table-column>
        <el-table-column prop="source_publish_date" label="日期" width="120" />
        <!-- <el-table-column label="来源" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source_type === 'supervision' ? 'warning' : 'info'">
              {{ row.source_type === 'supervision' ? '飞行检查' : '抽检通告' }}
            </el-tag>
          </template>
        </el-table-column> -->
        <el-table-column prop="source_title" label="来源通告" min-width="240" show-overflow-tooltip />
        <el-table-column prop="product_name" label="问题对象/标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="company_names" label="企业名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="province_display" label="所在省份" width="120" show-overflow-tooltip />
        <!-- <el-table-column prop="inspection_institution" label="检验/检查机构" min-width="180" show-overflow-tooltip /> -->
        <el-table-column prop="unqualified_items" label="不符合规定项目/检查问题" min-width="240" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">查看详情</el-button>
            <el-button link type="success" @click="goSource(row)">查看来源</el-button>
            <el-button v-if="row.company_id" link type="warning" @click="goCompany(row.company_id)">企业详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :page-size="pagination.limit"
        :current-page="pagination.page"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @update:page-size="(value) => { pagination.limit = value }"
        @update:current-page="(value) => { pagination.page = value }"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getUnqualifiedProductFilterOptions,
  getUnqualifiedProducts,
  getUnqualifiedProductStats
} from '@/api/index'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const stats = ref({})
const summary = ref({
  batch_title: '',
  loaded_count: 0,
  total_batches: 0,
  source_count: 0,
  matched_count: 0,
  current_page_count: 0,
  province_count: 0
})
const filterOptions = ref({
  issue_items: [],
  product_categories: [],
  product_types: [],
  announcement_types: [],
  provinces: [],
  years: []
})
const filters = ref(createDefaultFilters())
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

function createDefaultFilters() {
  return {
    keyword: '',
    company_keyword: '',
    source_keyword: '',
    unqualified_item: '',
    issue_items: [],
    product_category: '',
    product_type: '',
    announcement_type: '',
    province: '',
    year: '',
    announcement_id: '',
    supervision_id: ''
  }
}

function parseIssueItemsQuery(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch (error) {
    return String(value || '').split('|').map((item) => item.trim()).filter(Boolean)
  }
}

function applyRouteFilters() {
  filters.value = {
    ...createDefaultFilters(),
    keyword: String(route.query.keyword || ''),
    company_keyword: String(route.query.company_keyword || ''),
    source_keyword: String(route.query.source_keyword || ''),
    unqualified_item: String(route.query.unqualified_item || ''),
    issue_items: parseIssueItemsQuery(route.query.issue_items),
    product_category: String(route.query.product_category || ''),
    product_type: String(route.query.product_type || ''),
    announcement_type: String(route.query.announcement_type || ''),
    province: String(route.query.province || ''),
    year: String(route.query.year || ''),
    announcement_id: String(route.query.announcement_id || ''),
    supervision_id: String(route.query.supervision_id || '')
  }
}

const hasActiveFilters = computed(() => Boolean(
  filters.value.keyword
  || filters.value.company_keyword
  || filters.value.source_keyword
  || filters.value.unqualified_item
  || (filters.value.issue_items || []).length
  || filters.value.product_category
  || filters.value.product_type
  || filters.value.announcement_type
  || filters.value.province
  || filters.value.year
  || filters.value.announcement_id
  || filters.value.supervision_id
))

async function loadData() {
  loading.value = true
  try {
    const res = await getUnqualifiedProducts({
      ...filters.value,
      issue_items: JSON.stringify(filters.value.issue_items || []),
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    tableData.value = res.data || []
    summary.value = res.summary || summary.value
    pagination.value.total = res.pagination?.total || 0
  } catch (error) {
    console.error('加载不合格产品失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await getUnqualifiedProductStats()
    stats.value = res.data || {}
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

async function loadFilterOptions() {
  try {
    const res = await getUnqualifiedProductFilterOptions()
    filterOptions.value = res.data || {
      issue_items: [],
      product_categories: [],
      product_types: [],
      announcement_types: [],
      provinces: [],
      years: []
    }
  } catch (error) {
    console.error('加载筛选项失败:', error)
  }
}

function handleSearch() {
  pagination.value.page = 1
  loadData()
}

function resetFilters() {
  filters.value = createDefaultFilters()
  pagination.value.page = 1
  loadData()
}

function viewDetail(id) {
  router.push(`/unqualified-products/${id}`)
}

function goSource(row) {
  if (row.announcement_id) {
    router.push(`/announcements/${row.announcement_id}`)
    return
  }
  if (row.supervision_id) {
    router.push(`/supervisions/${row.supervision_id}`)
  }
}

function goCompany(companyId) {
  router.push(`/companies/${companyId}`)
}

onMounted(async () => {
  applyRouteFilters()
  await Promise.all([loadData(), loadStats(), loadFilterOptions()])
})
</script>

<style scoped>
.unqualified-products {
  max-width: 1500px;
  margin: 0 auto;
}

.page-card {
  border-radius: 18px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.page-subtitle {
  margin-top: 6px;
  color: #909399;
  font-size: 13px;
}

.filter-form {
  margin-bottom: 20px;
  padding: 16px;
  background: #f7f9fc;
  border-radius: 14px;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.result-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  padding: 18px;
  border-radius: 10px;
  color: #fff;
  text-align: center;
}

.stat-card.danger {
  background: linear-gradient(135deg, #f56c6c 0%, #ff8a8a 100%);
}

.stat-card.primary {
  background: linear-gradient(135deg, #409eff 0%, #6ab7ff 100%);
}

.stat-card.success {
  background: linear-gradient(135deg, #67c23a 0%, #95d475 100%);
}

.stat-card.warning {
  background: linear-gradient(135deg, #e6a23c 0%, #f3c76a 100%);
}

.stat-value {
  font-size: 30px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.mb-20 {
  margin-bottom: 20px;
}
</style>
