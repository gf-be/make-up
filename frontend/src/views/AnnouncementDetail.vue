<template>
  <div class="announcement-detail">
    <el-page-header @back="goBack" title="返回公告列表" content="公告详情" />

    <el-card v-loading="loading" class="detail-card" shadow="never">
      <template v-if="announcement">
        <div class="header">
          <h1 class="title">{{ announcement.title }}</h1>
          <div class="meta">
            <el-tag :type="statusType">
              {{ statusText }}
            </el-tag>
            <span class="date">{{ formatDate(announcement.publish_date) }}</span>
            <span v-if="announcement.announcement_no" class="announcement-no">
              {{ announcement.announcement_no }}
            </span>
          </div>
        </div>

        <el-divider />

        <div class="content">
          <h3>关键信息</h3>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="检验单位">
              {{ announcement.inspection_unit || '暂无' }}
            </el-descriptions-item>
            <el-descriptions-item label="批次数量">
              {{ announcement.inspection_count || 0 }} 批次
            </el-descriptions-item>
            <el-descriptions-item label="检验时间">
              {{ announcement.inspection_start_date && announcement.inspection_end_date 
                  ? `${formatDate(announcement.inspection_start_date)} 至 ${formatDate(announcement.inspection_end_date)}`
                  : '暂无' }}
            </el-descriptions-item>
            <el-descriptions-item label="发布日期">
              {{ formatDate(announcement.publish_date) }}
            </el-descriptions-item>
          </el-descriptions>

          <h3>公告内容</h3>
          <div class="announcement-content" v-html="formatContent(announcement.content)"></div>

          <div v-if="announcement.attachment_path" class="attachment">
            <h3>附件下载</h3>
            <el-button type="primary" :icon="Download" @click="downloadAttachment">
              下载附件（{{ announcement.attachment_name || '附件' }}）
            </el-button>
          </div>

          <div class="product-details">
            <div class="section-header">
              <h3>批次不符合规定化妆品详细信息</h3>
              <div class="section-tags">
                <el-tag type="info">总计 {{ productDetailsSummary.total || 0 }} 批次</el-tag>
                <el-tag v-if="productDetailsSummary.has_filters" type="success">
                  当前筛选 {{ productDetailsSummary.filtered_total || 0 }} 批次
                </el-tag>
                <el-tag v-if="activeCounterfeitCount" type="danger">
                  涉嫌假冒 {{ activeCounterfeitCount }} 批次
                </el-tag>
              </div>
            </div>

            <el-form :model="productDetailFilters" inline class="detail-filter-form">
              <el-form-item label="不符合规定项目">
                <el-input
                  v-model="productDetailFilters.unqualified_item"
                  placeholder="输入项目关键字"
                  clearable
                  @keyup.enter="handleProductDetailSearch"
                />
              </el-form-item>
              <el-form-item label="企业名称">
                <el-input
                  v-model="productDetailFilters.company_keyword"
                  placeholder="输入注册人/备案人/企业名称"
                  clearable
                  @keyup.enter="handleProductDetailSearch"
                />
              </el-form-item>
              <el-form-item label="被抽样单位">
                <el-input
                  v-model="productDetailFilters.sample_unit_keyword"
                  placeholder="输入被抽样单位"
                  clearable
                  @keyup.enter="handleProductDetailSearch"
                />
              </el-form-item>
              <el-form-item label="是否涉嫌假冒">
                <el-select v-model="productDetailFilters.is_counterfeit" clearable placeholder="全部">
                  <el-option label="全部" value="" />
                  <el-option label="涉嫌假冒" value="1" />
                  <el-option label="非假冒" value="0" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleProductDetailSearch">筛选</el-button>
                <el-button @click="resetProductDetailFilters">重置</el-button>
              </el-form-item>
            </el-form>

            <el-table v-if="productDetails.length > 0" :data="productDetails" stripe v-loading="productDetailsLoading">
              <el-table-column type="expand" width="50">
                <template #default="{ row }">
                  <el-descriptions :column="2" border size="small" class="detail-expanded">
                    <el-descriptions-item label="注册人/备案人等名称">{{ row.company_names || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="注册人/备案人等地址">{{ row.company_addresses || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="被抽样单位名称">{{ row.sample_unit_name || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="被抽样单位地址">{{ row.sample_unit_address || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="生产日期">{{ row.production_date || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="限期使用日期/保质期">{{ row.expiry_date || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="所在地/进口地区">{{ row.product_region || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="注册/备案编号">{{ row.registration_no || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="生产许可证号">{{ row.production_license_no || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="检验结果">{{ row.inspection_result || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="规定要求">{{ row.requirement || '暂无' }}</el-descriptions-item>
                    <el-descriptions-item label="备注">{{ row.remarks || '暂无' }}</el-descriptions-item>
                  </el-descriptions>
                </template>
              </el-table-column>
              <el-table-column prop="sequence_no" label="序号" width="70" align="center" />
              <el-table-column prop="product_name" label="产品名称" min-width="220" show-overflow-tooltip />
              <el-table-column prop="company_names" label="注册人/备案人等名称" min-width="240" show-overflow-tooltip />
              <el-table-column prop="sample_unit_name" label="被抽样单位" min-width="220" show-overflow-tooltip />
              <el-table-column prop="package_spec" label="包装规格" width="120" show-overflow-tooltip />
              <el-table-column prop="batch_no" label="标示批号" width="140" show-overflow-tooltip />
              <el-table-column prop="inspection_institution" label="检验机构" min-width="180" show-overflow-tooltip />
              <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="220" show-overflow-tooltip />
              <el-table-column label="备注" width="120" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.is_counterfeit" type="danger" size="small">涉嫌假冒</el-tag>
                  <span v-else class="remark-text">{{ row.remarks && row.remarks !== '/' ? '有备注' : '无' }}</span>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else-if="!productDetailsLoading" description="当前条件下暂无可展示的批次明细" />
          </div>

        </div>

        <el-divider />

        <div class="related-inspections" v-if="relatedInspections.length > 0">

          <h3>相关检查记录</h3>
          <el-table :data="relatedInspections" stripe>
            <el-table-column prop="product_name" label="产品名称" min-width="200" />
            <el-table-column prop="brand" label="品牌" width="120" />
            <el-table-column prop="manufacturer" label="生产企业" min-width="200" />
            <el-table-column prop="inspection_result" label="检查结果" width="100">
              <template #default="{ row }">
                <el-tag :type="row.inspection_result === 'unqualified' ? 'danger' : 'success'" size="small">
                  {{ row.inspection_result === 'unqualified' ? '不合格' : '合格' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="unqualified_items" label="不合格项目" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="viewDetail(row.inspection_id || row.id)">

                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getAnnouncementById, getRelatedInspections, getAnnouncementProductDetails } from '@/api/index'

import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const productDetailsLoading = ref(false)
const announcement = ref(null)
const relatedInspections = ref([])
const productDetails = ref([])
const productDetailFilters = ref({
  unqualified_item: '',
  company_keyword: '',
  sample_unit_keyword: '',
  is_counterfeit: ''
})
const productDetailsSummary = ref({
  total: 0,
  counterfeit_count: 0,
  filtered_total: 0,
  filtered_counterfeit_count: 0,
  has_filters: false
})



const goBack = () => {
  router.push('/announcements')
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY年MM月DD日')
}

const formatContent = (content) => {
  if (!content) return '暂无内容'
  return content.replace(/\n/g, '<br>')
}

const downloadAttachment = () => {
  if (announcement.value?.attachment_path) {
    window.open(`http://localhost:3000${announcement.value.attachment_path}`, '_blank')
  }
}

const viewDetail = (id) => {
  router.push(`/inspections/${id}`)
}

const statusType = computed(() => {
  const map = {
    published: 'success',
    draft: 'info',
    archived: 'warning'
  }
  return map[announcement.value?.status] || 'info'
})

const statusText = computed(() => {
  const map = {
    published: '已发布',
    draft: '草稿',
    archived: '已归档'
  }
  return map[announcement.value?.status] || '未知状态'
})

const fetchAnnouncement = async () => {
  const id = route.params.id
  if (!id) {
    ElMessage.error('公告ID不存在')
    goBack()
    return
  }

  loading.value = true
  try {
    const [announcementRes] = await Promise.all([
      getAnnouncementById(id),
      fetchRelatedInspections(id),
      fetchProductDetails(id)
    ])

    announcement.value = announcementRes.data
  } catch (error) {
    ElMessage.error('获取公告详情失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const fetchRelatedInspections = async (announcementId) => {
  try {
    const res = await getRelatedInspections(announcementId)
    relatedInspections.value = res.data || []
  } catch (error) {
    console.error('获取相关检查记录失败:', error)
    relatedInspections.value = []
  }
}

const fetchProductDetails = async (announcementId) => {
  productDetailsLoading.value = true
  try {
    const res = await getAnnouncementProductDetails(announcementId, {
      ...productDetailFilters.value
    })
    productDetails.value = res.data || []
    productDetailsSummary.value = res.summary || {
      total: 0,
      counterfeit_count: 0,
      filtered_total: 0,
      filtered_counterfeit_count: 0,
      has_filters: false
    }
  } catch (error) {
    console.error('获取公告批次明细失败:', error)
    productDetails.value = []
    productDetailsSummary.value = {
      total: 0,
      counterfeit_count: 0,
      filtered_total: 0,
      filtered_counterfeit_count: 0,
      has_filters: false
    }
  } finally {
    productDetailsLoading.value = false
  }
}

const handleProductDetailSearch = () => {
  if (announcement.value?.id || route.params.id) {
    fetchProductDetails(announcement.value?.id || route.params.id)
  }
}

const resetProductDetailFilters = () => {
  productDetailFilters.value = {
    unqualified_item: '',
    company_keyword: '',
    sample_unit_keyword: '',
    is_counterfeit: ''
  }
  handleProductDetailSearch()
}



onMounted(() => {
  fetchAnnouncement()
})
</script>

<style scoped>
.announcement-detail {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.detail-card {
  margin-top: 20px;
}

.header {
  margin-bottom: 20px;
}

.title {
  font-size: 24px;
  color: #303133;
  margin: 0 0 15px 0;
}

.meta {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #909399;
  font-size: 14px;
}

.date,
.source,
.announcement-no {
  font-size: 14px;
}

.announcement-no {
  color: #606266;
  font-weight: 500;
}

.content {
  padding: 10px 0;
}

.content h3 {
  font-size: 18px;
  color: #303133;
  margin: 20px 0 15px 0;
  border-left: 4px solid #409eff;
  padding-left: 10px;
}

.announcement-content {
  line-height: 1.8;
  color: #606266;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  white-space: pre-wrap;
}

.attachment {
  margin-top: 20px;
}

.product-details {
  margin-top: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.section-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-expanded {
  padding: 12px;
}

.remark-text {
  color: #909399;
}

.related-inspections {
  margin-top: 30px;
}

</style>
