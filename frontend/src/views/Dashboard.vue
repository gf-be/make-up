<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card announcement">
          <div class="stat-content">
            <el-icon class="stat-icon"><Bell /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.announcements?.total || 0 }}</div>
              <div class="stat-label">公告管理</div>
              <div class="stat-sub">已发布: {{ stats.announcements?.published || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card inspection">
          <div class="stat-content">
            <el-icon class="stat-icon"><Checked /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.inspections?.total || 0 }}</div>
              <div class="stat-label">抽样检查</div>
              <div class="stat-sub">总批次: {{ stats.inspections?.total_samples || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card company">
          <div class="stat-content">
            <el-icon class="stat-icon"><OfficeBuilding /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.companies?.total || 0 }}</div>
              <div class="stat-label">企业管理</div>
              <div class="stat-sub">生产企业: {{ stats.companies?.manufacturers || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card supervision">
          <div class="stat-content">
            <el-icon class="stat-icon"><Warning /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.supervisions?.total || 0 }}</div>
              <div class="stat-label">督查结果</div>
              <div class="stat-sub">进行中: {{ stats.supervisions?.ongoing || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>抽样检查合格率趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>督查状态分布</span>
            </div>
          </template>
          <div ref="supervisionChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>抽样检查合格率趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新公告</span>
              <el-button link @click="$router.push('/announcements')">更多</el-button>
            </div>
          </template>
          <el-table :data="stats.latest?.announcements || []" stripe>
            <el-table-column prop="title" label="标题" show-overflow-tooltip />
            <el-table-column prop="announcement_no" label="编号" width="100" />
            <el-table-column prop="publish_date" label="发布日期" width="110" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新检查</span>
              <el-button link @click="$router.push('/inspections')">更多</el-button>
            </div>
          </template>
          <el-table :data="stats.latest?.inspections || []" stripe>
            <el-table-column prop="title" label="标题" show-overflow-tooltip />
            <el-table-column prop="qualified_rate" label="合格率" width="80">
              <template #default="{ row }">
                {{ row.qualified_rate }}%
              </template>
            </el-table-column>
            <el-table-column prop="inspection_date" label="检查日期" width="110" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新督查</span>
              <el-button link @click="$router.push('/supervisions')">更多</el-button>
            </div>
          </template>
          <el-table :data="stats.latest?.supervisions || []" stripe>
            <el-table-column prop="title" label="标题" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="supervision_date" label="督查日期" width="110" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20" v-if="stats.problemCompanies?.length > 0">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>高频问题企业 (不合格次数)</span>
            </div>
          </template>
          <el-table :data="stats.problemCompanies" stripe>
            <el-table-column prop="name" label="企业名称" min-width="200" />
            <el-table-column prop="brand" label="品牌" width="120" />
            <el-table-column prop="province" label="省份" width="100" />
            <el-table-column prop="inspection_count" label="检查次数" width="100" align="center" />
            <el-table-column prop="unqualified_count" label="不合格次数" width="120" align="center">
              <template #default="{ row }">
                <el-tag type="danger" size="small">{{ row.unqualified_count }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="viewCompany(row.id)">
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getDashboardStats, getDashboardTrends } from '@/api'

const router = useRouter()
const stats = ref({})
const trends = ref({})
const supervisionChartRef = ref(null)
const trendChartRef = ref(null)
let supervisionChart = null
let trendChart = null

const loadData = async () => {
  const [statsRes, trendsRes] = await Promise.all([
    getDashboardStats(),
    getDashboardTrends()
  ])
  stats.value = statsRes.data
  trends.value = trendsRes.data
}

const initCharts = () => {
  // 督查状态分布图
  if (supervisionChartRef.value) {
    supervisionChart = echarts.init(supervisionChartRef.value)
    supervisionChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left' },
      series: [
        {
          type: 'pie',
          radius: '50%',
          data: [
            { value: stats.value.supervisions?.ongoing || 0, name: '进行中' },
            { value: stats.value.supervisions?.completed || 0, name: '已完成' },
            { value: stats.value.supervisions?.pending || 0, name: '待整改' }
          ],
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

  // 趋势图
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value)
    const months = trends.value.inspections?.map(item => item.month) || []
    const rates = trends.value.inspections?.map(item => (item.avg_rate || 0).toFixed(2)) || []

    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: months
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%'
        }
      },
      series: [
        {
          name: '合格率',
          type: 'line',
          data: rates,
          smooth: true,
          areaStyle: {
            opacity: 0.3
          }
        }
      ]
    })
  }
}

const getStatusType = (status) => {
  const map = { ongoing: 'warning', completed: 'success', pending_rectification: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { ongoing: '进行中', completed: '已完成', pending_rectification: '待整改' }
  return map[status] || status
}

const viewCompany = (id) => {
  router.push(`/companies/${id}`)
}

onMounted(async () => {
  await loadData()
  await nextTick()
  initCharts()

  window.addEventListener('resize', () => {
    supervisionChart?.resize()
    trendChart?.resize()
  })
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.stat-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-card.announcement { border-left: 4px solid #409eff; }
.stat-card.inspection { border-left: 4px solid #e6a23c; }
.stat-card.company { border-left: 4px solid #67c23a; }
.stat-card.supervision { border-left: 4px solid #f56c6c; }

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  font-size: 48px;
  opacity: 0.8;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.stat-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.chart-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mt-20 {
  margin-top: 20px;
}
</style>
