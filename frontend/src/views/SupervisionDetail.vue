<template>
  <div class="supervision-detail" v-loading="loading">
    <el-card v-if="detail">
      <template #header>
        <div class="card-header">
          <span>{{ detail.title }}</span>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>

      <el-descriptions :column="3" border>
        <el-descriptions-item label="级别">
          <el-tag :type="getLevelType(detail.level)">{{ getLevelText(detail.level) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="督查类型">
          {{ detail.supervision_type || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="督查单位">
          {{ detail.supervision_unit || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="地区">
          {{ detail.region || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="督查日期">
          {{ detail.supervision_date || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(detail.status)">{{ getStatusText(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="整改期限" :span="2">
          {{ detail.rectification_deadline || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="浏览量">
          {{ detail.view_count || 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="来源" :span="3">
          {{ detail.source || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="content-section">
        <h3>督查内容</h3>
        <div class="content" v-html="detail.content || '暂无内容'"></div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getSupervisionDetail } from '@/api'

const route = useRoute()
const loading = ref(false)
const detail = ref(null)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getSupervisionDetail(route.params.id)
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

const getStatusType = (status) => {
  const map = { ongoing: 'warning', completed: 'success', pending_rectification: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { ongoing: '进行中', completed: '已完成', pending_rectification: '待整改' }
  return map[status] || status
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.supervision-detail {
  max-width: 1000px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
}

.content-section {
  margin-top: 30px;
}

.content-section h3 {
  margin-bottom: 15px;
  color: #303133;
}

.content {
  line-height: 1.8;
  color: #606266;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 4px;
}

.content :deep(p) {
  margin-bottom: 10px;
}
</style>
