<template>
  <div class="pivot-analysis" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="page-title">数据透视分析</div>
            <div class="page-subtitle">围绕批次、地区、产品类别、检验机构与问题类型做交叉统计，直接产出报告素材。</div>
          </div>
        </div>
      </template>

      <el-form :model="filters" label-width="92px" class="filter-form">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="通告批次">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.announcement_ids) ? `已选 ${pickLen(filters.announcement_ids)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.announcement_ids" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.announcements" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="行维度">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ labelForDimension(filters.row_dimension) }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-radio-wrap">
                  <el-radio-group v-model="filters.row_dimension" class="filter-radio-group">
                    <el-radio v-for="(label, key) in dimensions" :key="key" :label="key">{{ label }}</el-radio>
                  </el-radio-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="列维度">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ labelForDimension(filters.col_dimension) }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-radio-wrap">
                  <el-radio-group v-model="filters.col_dimension" class="filter-radio-group">
                    <el-radio v-for="(label, key) in dimensions" :key="key" :label="key">{{ label }}</el-radio>
                  </el-radio-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="统计指标">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ labelForMetric(filters.metric) }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-radio-wrap">
                  <el-radio-group v-model="filters.metric" class="filter-radio-group">
                    <el-radio v-for="(label, key) in metrics" :key="key" :label="key">{{ label }}</el-radio>
                  </el-radio-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产品类别">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.product_categories) ? `已选 ${pickLen(filters.product_categories)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.product_categories" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.product_categories" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产品标示地区">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.product_regions) ? `已选 ${pickLen(filters.product_regions)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.product_regions" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.product_regions" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="生产/备案地区">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.manufacturer_provinces) ? `已选 ${pickLen(filters.manufacturer_provinces)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.manufacturer_provinces" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.manufacturer_provinces" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="抽样地区">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.sampled_provinces) ? `已选 ${pickLen(filters.sampled_provinces)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.sampled_provinces" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.sampled_provinces" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="检验机构">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.inspection_institutions) ? `已选 ${pickLen(filters.inspection_institutions)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.inspection_institutions" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.inspection_institutions" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="问题类型">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.issue_categories) ? `已选 ${pickLen(filters.issue_categories)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.issue_categories" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.issue_categories" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="不符合项目">
              <div class="filter-hover-field">
                <div class="filter-hover-strip">
                  <span class="filter-hover-summary">{{ pickLen(filters.issue_items) ? `已选 ${pickLen(filters.issue_items)} 项` : '未选择' }}</span>
                  <span class="filter-hover-tip">悬停展开</span>
                </div>
                <div class="filter-checkbox-wrap">
                  <el-checkbox-group v-model="filters.issue_items" class="filter-checkbox-group">
                    <el-checkbox v-for="item in options.issue_items" :key="item.value" :label="item.value">
                      {{ item.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="关键词">
              <el-input v-model="filters.keyword" clearable placeholder="支持产品名、机构、地区、问题关键词" @keyup.enter="handleQuery" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="假冒筛选">
              <div class="action-row">
                <el-switch v-model="filters.counterfeit_only" active-text="仅看假冒" inactive-text="全部" />
                <el-button type="primary" @click="handleQuery">更新分析</el-button>
                <el-button @click="resetFilters">重置</el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-row :gutter="16" class="mt-16 stats-row">
      <el-col :span="4"><div class="stat-card"><div class="stat-value">{{ summary.total_records || 0 }}</div><div class="stat-label">明细记录</div></div></el-col>
      <el-col :span="4"><div class="stat-card blue"><div class="stat-value">{{ summary.total_batches || 0 }}</div><div class="stat-label">覆盖批次</div></div></el-col>
      <el-col :span="4"><div class="stat-card green"><div class="stat-value">{{ summary.total_categories || 0 }}</div><div class="stat-label">产品类别</div></div></el-col>
      <el-col :span="4"><div class="stat-card orange"><div class="stat-value">{{ summary.total_product_regions || 0 }}</div><div class="stat-label">产品地区</div></div></el-col>
      <el-col :span="4"><div class="stat-card purple"><div class="stat-value">{{ summary.total_sampled_provinces || 0 }}</div><div class="stat-label">抽样地区</div></div></el-col>
      <el-col :span="4"><div class="stat-card danger"><div class="stat-value">{{ summary.counterfeit_count || 0 }}</div><div class="stat-label">假冒记录</div></div></el-col>
    </el-row>

    <!-- <el-row :gutter="16" class="mt-16">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div class="card-header compact">
              <span>分析报告素材</span>
              <el-tag type="success">可直接提炼成报告段落</el-tag>
            </div>
          </template>
          <div v-if="insights.length" class="insight-list">
            <div v-for="item in insights" :key="item.title" class="insight-item">
              <div class="insight-title">{{ item.title }}</div>
              <div class="insight-content">{{ item.content }}</div>
            </div>
          </div>
          <el-empty v-else description="当前筛选结果暂无可提炼素材" />
        </el-card>
      </el-col>
    </el-row> -->

    <!-- <el-row :gutter="16" class="mt-16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <div class="card-header compact">
              <span>{{ pivot.row_dimension_label || '行维度' }}分布</span>
            </div>
          </template>
          <div ref="barChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <div class="card-header compact">
              <span>{{ pivot.row_dimension_label || '行维度' }} × {{ pivot.col_dimension_label || '列维度' }}</span>
            </div>
          </template>
          <div ref="stackChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row> -->

    <el-row :gutter="16" class="mt-16">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div class="card-header compact">
              <span>透视矩阵</span>
              <el-tag>{{ pivot.metric_label || '记录数' }}</el-tag>
            </div>
          </template>
          <el-table :data="pivot.rows || []" border stripe max-height="520">
            <el-table-column :label="pivot.row_dimension_label || '行维度'" prop="row_label" min-width="180" fixed />
            <el-table-column label="合计" prop="total" width="100" align="center" fixed="left" />
            <el-table-column v-for="column in pivot.columns || []" :key="column.key" :label="column.label" min-width="120" align="center">
              <template #default="{ row }">
                {{ row.cells_map?.[column.key] ?? 0 }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt-16">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div class="card-header compact">
              <span>明细样本（{{ detailPagination.total }} 条）</span>
              <el-tag type="info">分页展示</el-tag>
            </div>
          </template>
          <el-table :data="detailRecords" border stripe max-height="620">
            <el-table-column prop="announcement_label" label="批次通告" min-width="220" show-overflow-tooltip />
            <el-table-column prop="product_name" label="产品名称" min-width="220" show-overflow-tooltip />
            <el-table-column prop="product_category" label="产品类别" width="120" />
            <el-table-column prop="batch_no" label="产品批号" width="130" show-overflow-tooltip />
            <el-table-column prop="product_region" label="产品标示地区" width="130" />
            <el-table-column prop="manufacturer_province" label="生产/备案地区" width="130" />
            <el-table-column prop="sampled_province" label="抽样地区" width="120" />
            <el-table-column prop="inspection_institution" label="检验机构" min-width="180" show-overflow-tooltip />
            <el-table-column prop="issue_category" label="问题类型" width="120" />
            <el-table-column prop="is_counterfeit_label" label="假冒标记" width="100" />
            <el-table-column prop="sample_unit_name" label="被抽样单位" min-width="180" show-overflow-tooltip />
            <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="220" show-overflow-tooltip />
          </el-table>
          <el-pagination
            :page-size="detailPagination.limit"
            :current-page="detailPagination.page"
            :total="detailPagination.total"
            :page-sizes="[20, 50, 100, 200]"
            layout="total, sizes, prev, pager, next, jumper"
            class="detail-pagination"
            @update:page-size="(value) => { detailPagination.limit = value }"
            @update:current-page="(value) => { detailPagination.page = value }"
            @size-change="loadData"
            @current-change="loadData"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { getPivotAnalysis } from '@/api'

const loading = ref(false)
const options = reactive({
  announcements: [],
  product_categories: [],
  product_regions: [],
  manufacturer_provinces: [],
  sampled_provinces: [],
  inspection_institutions: [],
  issue_categories: [],
  issue_items: []
})
const dimensions = ref({})
const metrics = ref({})
const summary = ref({})
const insights = ref([])
const detailRecords = ref([])
const pivot = ref({ rows: [], columns: [] })
const detailPagination = reactive({
  page: 1,
  limit: 50,
  total: 0
})
const barChartRef = ref(null)
const stackChartRef = ref(null)
let barChart = null
let stackChart = null
let resizeHandler = null

const createDefaultFilters = () => ({
  announcement_ids: [],
  product_categories: [],
  product_regions: [],
  manufacturer_provinces: [],
  sampled_provinces: [],
  inspection_institutions: [],
  issue_categories: [],
  issue_items: [],
  keyword: '',
  counterfeit_only: false,
  row_dimension: 'product_category',
  col_dimension: 'sampled_province',
  metric: 'record_count'
})

const filters = reactive(createDefaultFilters())

const pickLen = (arr) => (Array.isArray(arr) ? arr.length : 0)

const labelForDimension = (key) => dimensions.value[key] || key

const labelForMetric = (key) => metrics.value[key] || key

const serializeParams = () => ({
  announcement_ids: JSON.stringify(filters.announcement_ids),
  product_categories: JSON.stringify(filters.product_categories),
  product_regions: JSON.stringify(filters.product_regions),
  manufacturer_provinces: JSON.stringify(filters.manufacturer_provinces),
  sampled_provinces: JSON.stringify(filters.sampled_provinces),
  inspection_institutions: JSON.stringify(filters.inspection_institutions),
  issue_categories: JSON.stringify(filters.issue_categories),
  issue_items: JSON.stringify(filters.issue_items),
  keyword: filters.keyword || undefined,
  counterfeit_only: filters.counterfeit_only ? 'true' : undefined,
  row_dimension: filters.row_dimension,
  col_dimension: filters.col_dimension,
  metric: filters.metric,
  detail_page: detailPagination.page,
  detail_limit: detailPagination.limit
})

const renderCharts = () => {
  const matrixRows = (pivot.value.rows || []).slice(0, 10)
  const matrixColumns = (pivot.value.columns || []).slice(0, 6)

  if (barChartRef.value) {
    barChart = barChart || echarts.init(barChartRef.value)
    barChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: matrixRows.map(item => item.row_label),
        axisLabel: { interval: 0, rotate: 25 }
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: pivot.value.metric_label || '记录数',
          type: 'bar',
          data: matrixRows.map(item => item.total),
          itemStyle: { color: '#667eea' },
          label: { show: true, position: 'top' }
        }
      ]
    })
  }

  if (stackChartRef.value) {
    stackChart = stackChart || echarts.init(stackChartRef.value)
    stackChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: matrixRows.map(item => item.row_label),
        axisLabel: { interval: 0, rotate: 20 }
      },
      yAxis: { type: 'value' },
      series: matrixColumns.map((column, index) => ({
        name: column.label,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: matrixRows.map(item => item.cells_map?.[column.key] ?? 0),
        itemStyle: {
          color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#9a60b4'][index % 6]
        }
      }))
    })
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getPivotAnalysis(serializeParams())
    summary.value = res.data.summary || {}
    insights.value = res.data.insights || []
    detailRecords.value = res.data.detail_records || []
    pivot.value = res.data.pivot || { rows: [], columns: [] }
    dimensions.value = res.data.dimensions || {}
    metrics.value = res.data.metrics || {}

    Object.assign(options, {
      announcements: res.data.options?.announcements || [],
      product_categories: res.data.options?.product_categories || [],
      product_regions: res.data.options?.product_regions || [],
      manufacturer_provinces: res.data.options?.manufacturer_provinces || [],
      sampled_provinces: res.data.options?.sampled_provinces || [],
      inspection_institutions: res.data.options?.inspection_institutions || [],
      issue_categories: res.data.options?.issue_categories || [],
      issue_items: res.data.options?.issue_items || []
    })

    Object.assign(detailPagination, {
      total: res.data.detail_pagination?.total || 0,
      page: res.data.detail_pagination?.page || detailPagination.page,
      limit: res.data.detail_pagination?.limit || detailPagination.limit
    })

    await nextTick()
    renderCharts()
  } catch (error) {
    console.error('加载透视分析失败:', error)
    ElMessage.error('加载透视分析失败')
  } finally {
    loading.value = false
  }
}

const handleQuery = async () => {
  detailPagination.page = 1
  await loadData()
}

const resetFilters = async () => {
  Object.assign(filters, createDefaultFilters())
  Object.assign(detailPagination, { page: 1, limit: 50 })
  await loadData()
}

onMounted(async () => {
  await loadData()
  resizeHandler = () => {
    barChart?.resize()
    stackChart?.resize()
  }
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  barChart?.dispose()
  stackChart?.dispose()
})
</script>

<style scoped>
.pivot-analysis {
  max-width: 1500px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.card-header.compact {
  min-height: 28px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.page-subtitle {
  margin-top: 6px;
  color: #909399;
  font-size: 13px;
}

.filter-form {
  margin-top: 4px;
}

.filter-form :deep(.el-col) {
  position: relative;
}

.filter-hover-field {
  position: relative;
  width: 100%;
  z-index: 1;
}

.filter-hover-field:hover {
  z-index: 30;
}

.filter-hover-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: #606266;
  cursor: default;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.filter-hover-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-hover-tip {
  flex-shrink: 0;
  font-size: 12px;
  color: #c0c4cc;
  transition: color 0.15s ease;
}

.filter-hover-field:hover .filter-hover-strip {
  border-color: #409eff;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.filter-hover-field:hover .filter-hover-tip {
  color: #409eff;
}

.filter-hover-field .filter-checkbox-wrap,
.filter-hover-field .filter-radio-wrap {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: -1px;
  max-height: 0;
  opacity: 0;
  visibility: hidden;
  overflow: hidden;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #fafbfc;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  transition:
    max-height 0.22s ease,
    opacity 0.18s ease,
    padding 0.18s ease,
    visibility 0.18s ease,
    border-color 0.15s ease;
  pointer-events: none;
}

.filter-hover-field:hover .filter-checkbox-wrap,
.filter-hover-field:hover .filter-radio-wrap {
  max-height: 280px;
  opacity: 1;
  visibility: visible;
  padding: 10px 12px;
  border-color: #dcdfe6;
  border-top-color: #e4e7ed;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  overflow: auto;
  pointer-events: auto;
}

.filter-checkbox-group,
.filter-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: flex-start;
  line-height: 1.5;
}

.filter-checkbox-group :deep(.el-checkbox),
.filter-radio-group :deep(.el-radio) {
  margin-right: 0;
  height: auto;
  white-space: normal;
  align-items: flex-start;
}

.filter-radio-group :deep(.el-radio__label) {
  white-space: normal;
  line-height: 1.45;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mt-16 {
  margin-top: 16px;
}

.stats-row .stat-card {
  border-radius: 12px;
  padding: 18px 16px;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.18);
}

.stats-row .stat-card.blue { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.stats-row .stat-card.green { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
.stats-row .stat-card.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
.stats-row .stat-card.purple { background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); }
.stats-row .stat-card.danger { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.95;
}

.insight-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.insight-item {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
}

.insight-title {
  font-size: 14px;
  font-weight: 700;
  color: #303133;
}

.insight-content {
  margin-top: 8px;
  color: #606266;
  line-height: 1.7;
}

.chart-box {
  height: 360px;
}

.detail-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
