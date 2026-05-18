<template>
  <!-- <div v-if="isCompaniesListBlockedForNormalUser" class="companies companies--restricted">
    <el-card>
      <el-result icon="info" title="企业列表未开放" sub-title="普通用户可从「产品文案」进入关联企业的详情页。">
        <template #extra>
          <el-button type="primary" @click="$router.push('/unqualified-products')">前往产品文案</el-button>
        </template>
      </el-result>
    </el-card>
  </div> -->
  <!-- <div v-else class="companies"> -->
  <div  class="companies">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>企业列表</span>
          <el-button type="primary" @click="$router.push('/companies/unqualified')">
            <el-icon><DataAnalysis /></el-icon>
            不合格企业
          </el-button>
        </div>
      </template>

      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="企业名称">
          <el-input v-model="filters.name" placeholder="输入企业名称" clearable @keyup.enter="loadData" />
        </el-form-item>
        <!-- <el-form-item label="品牌">
          <el-input v-model="filters.brand" placeholder="输入品牌" clearable @keyup.enter="loadData" />
        </el-form-item> -->
        <el-form-item label="省份">
          <el-select v-model="filters.province" placeholder="全部省份" clearable filterable style="width: 180px" @change="loadData">
            <el-option v-for="item in filterOptions.provinces" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="产品分类">
          <el-select v-model="filters.product_category" placeholder="全部产品分类" clearable filterable style="width: 220px" @change="loadData">
            <el-option v-for="item in filterOptions.product_categories" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="只看不合格">
          <el-switch v-model="filters.has_unqualified" active-text="是" inactive-text="否" @change="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      
      <el-table :data="tableData" stripe v-loading="loading" class="table-height">
        <el-table-column prop="name" label="企业名称" min-width="200" show-overflow-tooltip />
        <!-- <el-table-column prop="brand" label="品牌" width="120" /> -->
        <el-table-column prop="sampled_count" label="抽查次数" width="100" align="center" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeType(row.type)" size="small">
              {{ getTypeText(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="province" label="省份" width="100" />
        <el-table-column prop="product_category" label="产品分类" width="140" show-overflow-tooltip />
        <!-- <el-table-column prop="city" label="城市" width="100" /> -->
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DataAnalysis, Search } from '@element-plus/icons-vue'
import { getCompanies, getCompanyFilterOptions, getCompanyStats } from '@/api/index'
import { currentUser } from '@/utils/auth'

const router = useRouter()

/** 普通用户可访问 /companies 路由但不展示企业列表模块（仍可访问 /companies/:id） */
// const isCompaniesListBlockedForNormalUser = computed(() => currentUser.value?.role === 'normal_user')
const loading = ref(false)
const tableData = ref([])
const companyStats = ref({})
const filterOptions = ref({
  provinces: [],
  product_categories: []
})
const filters = ref({
  name: '',
  brand: '',
  province: '',
  product_category: '',
  has_unqualified: false
})
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getCompanies({
      ...filters.value,
      has_unqualified: filters.value.has_unqualified ? 'true' : undefined,
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

const loadFilterOptions = async () => {
  try {
    const res = await getCompanyFilterOptions()
    filterOptions.value = res.data || {
      provinces: [],
      product_categories: []
    }
  } catch (error) {
    console.error('加载企业筛选项失败:', error)
  }
}

const resetFilters = () => {
  filters.value = {
    name: '',
    brand: '',
    province: '',
    product_category: '',
    has_unqualified: false
  }
  pagination.value.page = 1
  loadData()
}

const viewDetail = (id) => {
  router.push(`/companies/${id}`)
}

const getTypeType = (type) => {
  const map = { manufacturer: 'primary', distributor: 'success', seller: 'info' }
  return map[type] || 'info'
}

const getTypeText = (type) => {
  const map = { manufacturer: '生产企业', distributor: '经销商', seller: '销售商' }
  return map[type] || type
}

onMounted(() => {
  if (isCompaniesListBlockedForNormalUser.value) return
  loadStats()
  loadFilterOptions()
  loadData()
})
</script>

<style scoped>
.companies {
  max-width: 1400px;
  margin: 0 auto;
}

.companies--restricted :deep(.el-result) {
  padding: 24px 16px;
}
/* 全局表格最高优先级样式 */
.table-height {
    border: 1px solid #bdd0fb !important; /* 外框蓝色实线 */
  }
  
  /* 表头：蓝色背景 + 白色文字 */
  .table-height :deep(.el-table__header th) {
    background-color: #9cb9f7 !important;
    color: #ffffff !important;
    border: 1px solid #c7d5f3 !important; /* 表头边框同色 */
    font-weight: 600 !important;
  }
  
  /* 单元格：白色背景 + 蓝色实线网格 */
  .table-height :deep(.el-table__body td) {
    border: 1px solid #dce6fc !important; /* 蓝色实线网格 */
    background-color: #ffffff !important;
  }
  
  /* 悬浮行效果 */
  .table-height :deep(.el-table__row:hover td) {
    background-color: #E6F0FF !important; /* 浅蓝悬浮背景 */
  }

 
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.stat-item.inspected {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-item.unqualified {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-item.rate {
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
