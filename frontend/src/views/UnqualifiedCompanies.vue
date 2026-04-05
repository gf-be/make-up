<template>
  <div class="unqualified-companies">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>不合格企业列表</span>
          <el-tag type="danger" size="large">{{ pagination.total }} 家</el-tag>
        </div>
      </template>

      <!-- 数据表格 -->
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column type="index" label="排名" width="60" />
        <el-table-column prop="name" label="企业名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="brand" label="品牌" width="120" />
        <el-table-column prop="province" label="省份" width="100" />
        <el-table-column prop="unqualified_count" label="不合格次数" width="120" align="center" sortable>
          <template #default="{ row }">
            <el-tag type="danger" size="large">{{ row.unqualified_count }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unqualified_products" label="不合格产品" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip :content="row.unqualified_products" placement="top">
              <span>{{ truncateText(row.unqualified_products, 50) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="last_unqualified_date" label="最近不合格日期" width="130" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:page-size="pagination.limit"
        v-model:current-page="pagination.page"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>

    <!-- 统计图表 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>不合格次数TOP10</span>
            </div>
          </template>
          <div ref="chartRef" style="height: 350px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>省份分布</span>
            </div>
          </template>
          <div ref="provinceChartRef" style="height: 350px"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getUnqualifiedCompanies, getCompanyStats } from '@/api/index'
import * as echarts from 'echarts'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const companyStats = ref({})
const chartRef = ref(null)
const provinceChartRef = ref(null)
let chart = null
let provinceChart = null

const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getUnqualifiedCompanies({
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    tableData.value = res.data
    pagination.value.total = res.pagination.total
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getCompanyStats()
    companyStats.value = res.data
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

const viewDetail = (id) => {
  router.push(`/companies/${id}`)
}

const truncateText = (text, length) => {
  if (!text) return '-'
  return text.length > length ? text.substring(0, length) + '...' : text
}

const initCharts = () => {
  // 不合格次数TOP10图表
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    const topUnqualified = companyStats.value.top_unqualified || []

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: topUnqualified.map(item => item.name || item.brand || '未知'),
        axisLabel: {
          interval: 0,
          rotate: 30
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '不合格次数',
          type: 'bar',
          data: topUnqualified.map(item => item.unqualified_count),
          itemStyle: {
            color: '#f56c6c'
          },
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    })
  }

  // 省份分布图
  if (provinceChartRef.value) {
    provinceChart = echarts.init(provinceChartRef.value)
    const provinceStats = companyStats.value.province_stats || []

    provinceChart.setOption({
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '企业数量',
          type: 'pie',
          radius: '50%',
          data: provinceStats.map(item => ({
            value: item.count,
            name: item.province
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    })
  }
}

onMounted(async () => {
  await Promise.all([loadStats(), loadData()])
  await nextTick()
  initCharts()

  window.addEventListener('resize', () => {
    chart?.resize()
    provinceChart?.resize()
  })
})
</script>

<style scoped>
.unqualified-companies {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.mt-20 {
  margin-top: 20px;
}
</style>
