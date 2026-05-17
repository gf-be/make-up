<template>
  <div class="usage-records-page" v-loading="loading">
    <el-page-header @back="goBack" title="返回不合格产品" content="产品使用情况" />

    <el-card class="summary-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">{{ product.product_name || '产品使用情况' }}</div>
            <div class="subtitle">{{ product.source_title || product.manufacturer_name || product.company_names || '-' }}</div>
          </div>
          <div class="summary-tags">
            <el-tag type="success">使用 {{ summary.total_usage_count || 0 }} 次</el-tag>
            <el-tag type="info">{{ summary.user_count || 0 }} 个用户</el-tag>
          </div>
        </div>
      </template>

      <el-table :data="records" border stripe>
        <el-table-column type="index" label="#" width="64" align="center" />
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <span class="user-display">{{ row.display_name || row.username || '—' }}</span>
              <span
                v-if="row.display_name && row.username && row.display_name !== row.username"
                class="user-login"
              >（{{ row.username }}）</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="user_id" label="用户ID" width="100" align="center">
          <template #default="{ row }">{{ row.user_id != null && row.user_id !== '' ? row.user_id : '—' }}</template>
        </el-table-column>
        <el-table-column label="累计使用次数" width="140" align="center">
          <template #default="{ row }">
            <el-tag type="warning" size="small">{{ Number(row.use_count) || 0 }} 次</el-tag>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="first_used_at" label="首次使用" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.first_used_at) }}</template>
        </el-table-column> -->
        <el-table-column prop="last_used_at" label="最近使用" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.last_used_at) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        :page-size="pagination.limit"
        :current-page="pagination.page"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @update:page-size="handlePageSizeChange"
        @update:current-page="handlePageChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUnqualifiedProductUsageRecords } from '@/api/index'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const product = ref({})
const records = ref([])
const summary = reactive({
  total_usage_count: 0,
  user_count: 0
})
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

async function loadData() {
  loading.value = true
  try {
    const res = await getUnqualifiedProductUsageRecords(route.params.id, {
      page: pagination.page,
      limit: pagination.limit
    })
    product.value = res.product || {}
    records.value = res.data || []
    Object.assign(summary, {
      total_usage_count: Number(res.summary?.total_usage_count || 0),
      user_count: Number(res.summary?.user_count || 0)
    })
    pagination.total = Number(res.pagination?.total || 0)
  } catch (error) {
    console.error('加载产品使用记录失败:', error)
  } finally {
    loading.value = false
  }
}

function handlePageSizeChange(value) {
  pagination.limit = value
  pagination.page = 1
  loadData()
}

function handlePageChange(value) {
  pagination.page = value
  loadData()
}

function goBack() {
  router.push('/unqualified-products')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.usage-records-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.summary-card {
  margin-top: 20px;
  border-radius: 18px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.subtitle {
  margin-top: 6px;
  color: #909399;
}

.summary-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.user-cell {
  line-height: 1.5;
}

.user-display {
  font-weight: 500;
  color: #303133;
}

.user-login {
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
