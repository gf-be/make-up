<template>
  <div class="unqualified-products">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>不符合规定化妆品</span>
          <el-tag type="danger" size="large">已录入 {{ summary.loaded_count }} / {{ summary.total_batches || 0 }} 批次</el-tag>
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

      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索产品、企业、抽样单位、检验机构"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="不符合项目">
          <el-input
            v-model="filters.unqualified_item"
            placeholder="如：菌落总数"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-row :gutter="16" class="stats-row">
        <el-col :span="6">
          <div class="stat-card danger">
            <div class="stat-value">{{ stats.loaded_count || 0 }}</div>
            <div class="stat-label">已录入批次</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card primary">
            <div class="stat-value">{{ stats.total_batches || 0 }}</div>
            <div class="stat-label">通告总批次</div>
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
            <div class="stat-value">{{ stats.institution_count || 0 }}</div>
            <div class="stat-label">检验机构数</div>
          </div>
        </el-col>
      </el-row>

      <el-table :data="tableData" stripe border v-loading="loading">
        <el-table-column type="expand" width="50">
          <template #default="{ row }">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="企业地址">{{ row.company_addresses || '-' }}</el-descriptions-item>
              <el-descriptions-item label="被抽样单位地址">{{ row.sample_unit_address || '-' }}</el-descriptions-item>
              <el-descriptions-item label="包装规格">{{ row.package_spec || '-' }}</el-descriptions-item>
              <el-descriptions-item label="标示批号">{{ row.batch_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="标示生产日期">{{ row.production_date || '-' }}</el-descriptions-item>
              <el-descriptions-item label="限期使用日期/保质期">{{ row.expiry_date || '-' }}</el-descriptions-item>
              <el-descriptions-item label="所在地/进口地区">{{ row.product_region || '-' }}</el-descriptions-item>
              <el-descriptions-item label="注册/备案编号">{{ row.registration_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="生产许可证号">{{ row.production_license_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ row.remarks || '-' }}</el-descriptions-item>
              <el-descriptions-item label="检验结果" :span="2">{{ row.inspection_result || '-' }}</el-descriptions-item>
              <el-descriptions-item label="规定要求" :span="2">{{ row.requirement || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>
        </el-table-column>
        <el-table-column prop="sequence_no" label="序号" width="70" align="center" />
        <el-table-column prop="product_name" label="标示产品名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="company_names" label="注册人/备案人/生产企业" min-width="240" show-overflow-tooltip />
        <el-table-column prop="sample_unit_name" label="被抽样单位名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="inspection_institution" label="检验机构" min-width="180" show-overflow-tooltip />
        <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="160" show-overflow-tooltip />
      </el-table>

      <el-pagination
        :page-size="pagination.limit"
        :current-page="pagination.page"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
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
import { onMounted, ref } from 'vue'
import { getUnqualifiedProducts, getUnqualifiedProductStats } from '@/api/index'

const loading = ref(false)
const tableData = ref([])
const stats = ref({})
const summary = ref({
  batch_title: '',
  loaded_count: 0,
  total_batches: 0
})
const filters = ref({
  keyword: '',
  unqualified_item: ''
})
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getUnqualifiedProducts({
      ...filters.value,
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    tableData.value = res.data
    summary.value = res.summary || summary.value
    pagination.value.total = res.pagination.total
  } catch (error) {
    console.error('加载不符合规定化妆品失败:', error)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getUnqualifiedProductStats()
    stats.value = res.data || {}
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  loadData()
}

const resetFilters = () => {
  filters.value = {
    keyword: '',
    unqualified_item: ''
  }
  pagination.value.page = 1
  loadData()
}

onMounted(async () => {
  await Promise.all([loadData(), loadStats()])
})
</script>

<style scoped>
.unqualified-products {
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

.filter-form {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
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
