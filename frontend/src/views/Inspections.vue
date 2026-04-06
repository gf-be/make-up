<template>
  <div class="inspections">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>抽样检查</span>
        </div>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ stats.total || 0 }}</div>
            <div class="stat-label">总计</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item national">
            <div class="stat-value">{{ stats.national || 0 }}</div>
            <div class="stat-label">国家级</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item provincial">
            <div class="stat-value">{{ stats.provincial || 0 }}</div>
            <div class="stat-label">省级</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item municipal">
            <div class="stat-value">{{ stats.municipal || 0 }}</div>
            <div class="stat-label">市级</div>
          </div>
        </el-col>
      </el-row>

      <!-- 筛选栏 -->
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="级别">
          <el-select v-model="filters.level" style="width: 240px" placeholder="选择级别" clearable @change="loadData">
            <el-option label="国家级" value="national" />
            <el-option label="省级" value="provincial" />
            <el-option label="市级" value="municipal" />
          </el-select>
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="filters.region" placeholder="输入地区" clearable @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="搜索标题或批次号" clearable @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="batch_number" label="批次号" width="140" />
        <el-table-column prop="level" label="级别" width="80">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)" size="small">
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="region" label="地区" width="120" />
        <el-table-column prop="total_samples" label="总样本数" width="90" align="center" />
        <el-table-column prop="qualified_count" label="合格数" width="90" align="center">
          <template #default="{ row }">
            <span style="color: #67c23a">{{ row.qualified_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="unqualified_count" label="不合格数" width="90" align="center">
          <template #default="{ row }">
            <span style="color: #f56c6c">{{ row.unqualified_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="qualified_rate" label="合格率" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getRateType(row.qualified_rate)" size="small">
              {{ row.qualified_rate }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="inspection_date" label="检查日期" width="110" />
        <el-table-column prop="view_count" label="浏览量" width="80" />
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getInspections, getInspectionStats } from '@/api'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const stats = ref({})
const filters = ref({
  level: '',
  region: '',
  keyword: ''
})
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getInspections({
      ...filters.value,
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
    const res = await getInspectionStats()
    stats.value = res.data
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

const resetFilters = () => {
  filters.value = {
    level: '',
    region: '',
    keyword: ''
  }
  pagination.value.page = 1
  loadData()
}

const viewDetail = (id) => {
  router.push(`/inspections/${id}`)
}

const getLevelType = (level) => {
  const map = { national: 'danger', provincial: 'warning', municipal: 'info' }
  return map[level] || 'info'
}

const getLevelText = (level) => {
  const map = { national: '国家级', provincial: '省级', municipal: '市级' }
  return map[level] || level
}

const getRateType = (rate) => {
  if (rate >= 95) return 'success'
  if (rate >= 80) return 'warning'
  return 'danger'
}

onMounted(() => {
  loadStats()
  loadData()
})
</script>

<style scoped>
.inspections {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  font-size: 18px;
  font-weight: bold;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.stat-item.national {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-item.provincial {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-item.municipal {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.filter-form {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
