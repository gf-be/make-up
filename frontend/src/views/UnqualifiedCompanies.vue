<template>
  <div class="unqualified-companies">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="page-title">不合格企业列表</div>
            <div class="page-subtitle">支持按时间、地点、产品类型、来源记录和具体产品名称快速筛选，并可直接钻取到问题产品详情。</div>
          </div>
          <el-tag type="danger" size="large">当前 {{ pagination.total }} 家</el-tag>
        </div>
      </template>

      <el-form :model="filters" class="filter-form" label-width="96px">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="企业关键词">
              <el-input
                v-model="filters.keyword"
                clearable
                placeholder="搜索企业名或品牌"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="产品关键词">
              <el-input
                v-model="filters.product_keyword"
                clearable
                placeholder="搜索具体产品名称"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="来源通告">
              <el-input
                v-model="filters.source_keyword"
                clearable
                placeholder="搜索通告/检查标题"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="省份">
              <el-select v-model="filters.province" clearable filterable placeholder="全部省份" style="width: 100%">
                <el-option v-for="item in filterOptions.provinces" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="产品类型">
              <el-select v-model="filters.product_type" clearable placeholder="全部产品类型" style="width: 100%">
                <el-option v-for="item in filterOptions.product_types" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="来源类型">
              <el-select v-model="filters.source_type" clearable placeholder="全部来源" style="width: 100%">
                <el-option v-for="item in filterOptions.source_types" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="年份">
              <el-select v-model="filters.year" clearable filterable placeholder="全部年份" style="width: 100%">
                <el-option v-for="item in filterOptions.years" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <div class="filter-actions">
              <el-button type="primary" @click="handleSearch">搜索</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </div>
          </el-col>
        </el-row>
      </el-form>

      <div class="result-tags">
        <el-tag type="danger">命中 {{ pagination.total }} 家</el-tag>
        <el-tag type="info">当前页 {{ tableData.length }} 家</el-tag>
        <el-tag v-if="filters.year" type="warning">年份：{{ filters.year }}年</el-tag>
        <el-tag v-if="filters.source_type" type="success">来源：{{ getSourceTypeLabel(filters.source_type) }}</el-tag>
      </div>

      <el-table :data="tableData" stripe border v-loading="loading" max-height="680">
        <el-table-column type="index" label="排名" width="70" />
        <el-table-column prop="name" label="企业名称" min-width="220" show-overflow-tooltip />
        <!-- <el-table-column prop="brand" label="品牌" width="140" show-overflow-tooltip /> -->
        <el-table-column prop="province" label="省份" width="110" />
        <el-table-column prop="sampled_count" label="抽查次数" width="100" align="center" />
        <el-table-column prop="unqualified_count" label="不合格次数" width="120" align="center" sortable>
          <template #default="{ row }">
            <el-tag type="danger">{{ row.unqualified_count }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源类型" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatSourceTypes(row.source_types) }}
          </template>
        </el-table-column>
        <el-table-column prop="unqualified_products" label="问题产品" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip :content="row.unqualified_products || '-'" placement="top">
              <span>{{ truncateText(row.unqualified_products, 60) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="来源记录" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip :content="row.source_titles || '-'" placement="top">
              <span>{{ truncateText(row.source_titles, 70) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="last_unqualified_date" label="最近不合格日期" width="140" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">企业详情</el-button>
            <el-button link type="danger" @click="viewProducts(row)">问题产品</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :page-size="pagination.limit"
        :current-page="pagination.page"
        :total="pagination.total"
        :page-sizes="[10, 20]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @update:page-size="(value) => { pagination.limit = value }"
        @update:current-page="(value) => { pagination.page = value }"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">不合格次数 TOP10</div>
          </template>
          <div ref="chartRef" style="height: 350px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">不合格企业省份分布</div>
          </template>
          <div ref="provinceChartRef" style="height: 350px"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getCompanyStats,
  getUnqualifiedCompanies,
  getUnqualifiedCompanyFilterOptions
} from '@/api/index'

let echartsModulePromise = null
function loadEchartsModule() {
  if (!echartsModulePromise) {
    echartsModulePromise = import('echarts').then((mod) => mod.default || mod)
  }
  return echartsModulePromise
}

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const companyStats = ref({})
const chartRef = ref(null)
const provinceChartRef = ref(null)
const filterOptions = ref({
  provinces: [],
  product_types: [],
  source_types: [],
  years: []
})
const filters = ref(createDefaultFilters())
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})
let chart = null
let provinceChart = null
let resizeHandler = null

function createDefaultFilters() {
  return {
    keyword: '',
    product_keyword: '',
    source_keyword: '',
    province: '',
    product_type: '',
    source_type: '',
    year: ''
  }
}

function getSourceTypeLabel(value) {
  const map = {
    announcement: '抽检通告',
    inspection: '抽样检查',
    supervision: '飞行检查'
  }
  return map[value] || value || '-'
}

function formatSourceTypes(value) {
  return String(value || '')
    .split('、')
    .map((item) => getSourceTypeLabel(item))
    .filter(Boolean)
    .join('、') || '-'
}

function truncateText(text, length) {
  if (!text) return '-'
  return text.length > length ? `${text.substring(0, length)}...` : text
}

async function loadData() {
  loading.value = true
  try {
    const res = await getUnqualifiedCompanies({
      ...filters.value,
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    tableData.value = res.data || []
    pagination.value.total = res.pagination?.total || 0
  } catch (error) {
    console.error('加载不合格企业失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await getCompanyStats()
    companyStats.value = res.data || {}
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

async function loadFilterOptions() {
  try {
    const res = await getUnqualifiedCompanyFilterOptions()
    filterOptions.value = res.data || {
      provinces: [],
      product_types: [],
      source_types: [],
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
  router.push(`/companies/${id}`)
}

function viewProducts(row) {
  router.push({
    path: '/unqualified-products',
    query: {
      company_keyword: row.name || ''
    }
  })
}

async function initCharts() {
  const echarts = await loadEchartsModule()
  if (chartRef.value) {
    chart?.dispose()
    chart = echarts.init(chartRef.value)
    const topUnqualified = companyStats.value.top_unqualified || []
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: topUnqualified.map((item) => item.name || item.brand || '未知'),
        axisLabel: { interval: 0, rotate: 30 }
      },
      yAxis: { type: 'value' },
      series: [{
        name: '不合格次数',
        type: 'bar',
        data: topUnqualified.map((item) => item.unqualified_count),
        itemStyle: { color: '#f56c6c' },
        label: { show: true, position: 'top' }
      }]
    })
  }

  if (provinceChartRef.value) {
    provinceChart?.dispose()
    provinceChart = echarts.init(provinceChartRef.value)
    const provinceStats = companyStats.value.unqualified_province_stats || []
    provinceChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left' },
      series: [{
        name: '不合格企业数量',
        type: 'pie',
        radius: '50%',
        data: provinceStats.map((item) => ({ value: item.count, name: item.province })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    })
  }
}

onMounted(async () => {
  await Promise.all([loadFilterOptions(), loadStats(), loadData()])
  await nextTick()
  await initCharts()

  resizeHandler = () => {
    chart?.resize()
    provinceChart?.resize()
  }
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  chart?.dispose()
  provinceChart?.dispose()
})
</script>

<style scoped>
.unqualified-companies {
  max-width: 1500px;
  margin: 0 auto;
}

.page-card {
  border-radius: 18px;
}

.card-header,
.filter-actions {
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
  margin-bottom: 18px;
  padding: 16px;
  background: #f7f9fc;
  border-radius: 14px;
}

.filter-actions {
  height: 100%;
  justify-content: flex-end;
}

.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.mt-20 {
  margin-top: 20px;
}

.chart-header {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}
</style>
