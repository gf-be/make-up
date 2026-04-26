<template>
  <div class="inspection-detail" v-loading="loading">
    <el-card v-if="detail">
      <template #header>
        <div class="card-header">
          <span>{{ detail.title }}</span>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>

      <el-descriptions :column="3" border>
        <el-descriptions-item label="批次号">
          {{ detail.batch_number || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="级别">
          <el-tag :type="getLevelType(detail.level)">{{ getLevelText(detail.level) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="地区">
          {{ detail.region || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="检查单位">
          {{ detail.inspection_unit || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="检查日期">
          {{ detail.inspection_date || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          {{ detail.source || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="总样本数">
          {{ detail.total_samples || 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="合格数">
          <span style="color: #67c23a; font-weight: bold">{{ detail.qualified_count || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="不合格数">
          <span style="color: #f56c6c; font-weight: bold">{{ detail.unqualified_count || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="合格率" :span="2">
          <el-progress 
            :percentage="detail.qualified_rate || 0" 
            :color="getProgressColor(detail.qualified_rate)"
            :stroke-width="20"
          />
        </el-descriptions-item>
        <el-descriptions-item label="浏览量">
          {{ detail.view_count || 0 }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="summary-section" v-if="detail.summary">
        <h3>检查摘要</h3>
        <p class="summary">{{ detail.summary }}</p>
      </div>

      <div class="details-section" v-if="detail.details && detail.details.length > 0">
        <h3>检查详情</h3>
        <el-table :data="detail.details" stripe border>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip />
          <!-- <el-table-column prop="brand" label="品牌" width="120" /> -->
          <el-table-column prop="manufacturer" label="生产企业" min-width="200" show-overflow-tooltip />
          <el-table-column prop="sample_source" label="抽样地点" width="120" />
          <el-table-column prop="production_date" label="生产日期" width="110" />
          <el-table-column prop="inspection_result" label="检查结果" width="90">
            <template #default="{ row }">
              <el-tag :type="getResultType(row.inspection_result)" size="small">
                {{ getResultText(row.inspection_result) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="unqualified_items" label="不合格项目" min-width="150" show-overflow-tooltip />
          <el-table-column prop="inspection_standard" label="检查标准" width="120" />
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getInspectionDetail } from '@/api'

const route = useRoute()
const loading = ref(false)
const detail = ref(null)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getInspectionDetail(route.params.id)
    detail.value = res.data
  } catch (error) {
    console.error('加载详情失败:', error)
  } finally {
    loading.value = false
  }
}

const getLevelType = (level) => {
  const map = { national: 'danger', provincial: 'warning', municipal: 'info' }
  return map[level] || 'info'
}

const getLevelText = (level) => {
  const map = { national: '国家级', provincial: '省级', municipal: '市级' }
  return map[level] || level
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

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.inspection-detail {
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

.summary-section, .details-section {
  margin-top: 30px;
}

.summary-section h3, .details-section h3 {
  margin-bottom: 15px;
  color: #303133;
}

.summary {
  line-height: 1.8;
  color: #606266;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 4px;
}
</style>
