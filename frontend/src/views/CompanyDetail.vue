<template>
  <div class="company-detail" v-loading="loading">
    <el-card v-if="detail">
      <template #header>
        <div class="card-header">
          <span>{{ detail.company.name }}</span>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>

      <!-- 企业基本信息 -->
      <el-descriptions :column="3" border>
        <el-descriptions-item label="企业名称">
          {{ detail.company.name }}
        </el-descriptions-item>
        <!-- <el-descriptions-item label="品牌">
          {{ detail.company.brand || '-' }}
        </el-descriptions-item> -->
        <el-descriptions-item label="类型">
          <el-tag :type="getTypeType(detail.company.type)">
            {{ getTypeText(detail.company.type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="省份">
          {{ detail.company.province || '-' }}
        </el-descriptions-item>
        <!-- <el-descriptions-item label="城市">
          {{ detail.company.city || '-' }}
        </el-descriptions-item> -->
        <el-descriptions-item label="地址">
          {{ detail.company.address || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 统计信息 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ detail.stats.sampled_count || 0 }}</div>
            <div class="stat-label">被抽查次数</div>
          </div>
        </el-col>

        <el-col :span="6">
          <div class="stat-item product">
            <div class="stat-value">{{ detail.stats.product_count || 0 }}</div>
            <div class="stat-label">抽检产品数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item qualified">
            <div class="stat-value">{{ detail.stats.qualified_count || 0 }}</div>
            <div class="stat-label">合格数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item unqualified">
            <div class="stat-value">{{ detail.stats.unqualified_count || 0 }}</div>
            <div class="stat-label">不合格数</div>
          </div>
        </el-col>
      </el-row>

      <!-- 合格率展示 -->
      <el-row :gutter="20" class="mt-20">
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>合格率统计</span>
            </template>
            <el-progress
              type="dashboard"
              :percentage="detail.stats.qualified_rate || 0"
              :color="getProgressColor(detail.stats.qualified_rate)"
              :width="200"
            >
              <template #default="{ percentage }">
                <span class="percentage-value">{{ percentage.toFixed(1) }}%</span>
                <span class="percentage-label">合格率</span>
              </template>
            </el-progress>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>检查结果分布</span>
            </template>
            <div class="result-distribution">
              <div class="result-item qualified">
                <div class="result-label">合格</div>
                <div class="result-value">{{ detail.stats.qualified_count || 0 }}</div>
              </div>
              <div class="result-item unqualified">
                <div class="result-label">不合格</div>
                <div class="result-value">{{ detail.stats.unqualified_count || 0 }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 检查历史 -->
      <div class="history-section">
        <h3>检查历史记录</h3>
        <el-table :data="detail.history" stripe border>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="title" label="检查批次" min-width="200" show-overflow-tooltip />
          <el-table-column prop="source_type" label="来源" width="120">
            <template #default="{ row }">
              {{ getSourceTypeText(row.source_type) }}
            </template>
          </el-table-column>

          <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip />
          <!-- <el-table-column prop="brand" label="品牌" width="120" /> -->

          <el-table-column prop="inspection_date" label="检查日期" width="110" />
          <el-table-column prop="level" label="级别" width="80">
            <template #default="{ row }">
              <el-tag :type="getLevelType(row.level)" size="small">
                {{ getLevelText(row.level) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="inspection_result" label="检查结果" width="90">
            <template #default="{ row }">
              <el-tag :type="getResultType(row.inspection_result)" size="small">
                {{ getResultText(row.inspection_result) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="unqualified_items" label="不合格项目" min-width="150" show-overflow-tooltip />
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getCompanyDetail } from '@/api/index'

const route = useRoute()
const loading = ref(false)
const detail = ref(null)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getCompanyDetail(route.params.id)
    detail.value = res.data
  } catch (error) {
    console.error('加载详情失败:', error)
  } finally {
    loading.value = false
  }
}

const getTypeType = (type) => {
  const map = { manufacturer: 'primary', distributor: 'success', seller: 'info' }
  return map[type] || 'info'
}

const getTypeText = (type) => {
  const map = { manufacturer: '生产企业', distributor: '经销商', seller: '销售商' }
  return map[type] || type
}

const getProgressColor = (rate) => {
  if (rate >= 95) return '#67c23a'
  if (rate >= 80) return '#e6a23c'
  return '#f56c6c'
}

const getResultType = (result) => {
  const map = { qualified: 'success', unqualified: 'danger', pending: 'info' }
  return map[result] || 'info'
}

const getResultText = (result) => {
  const map = { qualified: '合格', unqualified: '不合格', pending: '待定' }
  return map[result] || result
}

const getSourceTypeText = (sourceType) => {
  const map = {
    announcement: '抽检通告',
    inspection: '抽样检查',
    supervision: '飞行检查'
  }
  return map[sourceType] || sourceType || '-'
}

const getLevelType = (level) => {

  const map = { national: 'danger', provincial: 'warning', municipal: 'info' }
  return map[level] || 'info'
}

const getLevelText = (level) => {
console.log(level);
  const map = { national: '国家级', provincial: '省级', municipal: '市级' }
  return map[level] || level
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.company-detail {
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

.stats-row {
  margin-top: 20px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.stat-item.product {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-item.qualified {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-item.unqualified {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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

.mt-20 {
  margin-top: 20px;
}

.percentage-value {
  display: block;
  font-size: 28px;
  font-weight: bold;
}

.percentage-label {
  display: block;
  font-size: 14px;
  opacity: 0.8;
}

.result-distribution {
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
}

.result-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  min-width: 120px;
}

.result-item.qualified {
  background: #f0f9ff;
  color: #67c23a;
}

.result-item.unqualified {
  background: #fef0f0;
  color: #f56c6c;
}

.result-label {
  font-size: 14px;
  margin-bottom: 8px;
  opacity: 0.8;
}

.result-value {
  font-size: 32px;
  font-weight: bold;
}

.history-section {
  margin-top: 30px;
}

.history-section h3 {
  margin-bottom: 15px;
  color: #303133;
}
</style>
