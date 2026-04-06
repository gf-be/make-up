<template>
  <div class="announcement-detail">
    <el-page-header @back="goBack" title="返回公告列表" content="公告详情" />

    <el-card v-loading="loading" class="detail-card" shadow="never">
      <template v-if="announcement">
        <div class="header">
          <h1 class="title">{{ announcement.title }}</h1>
          <div class="meta">
            <el-tag :type="statusType">{{ statusText }}</el-tag>
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
                <el-select v-model="productDetailFilters.is_counterfeit" style="width: 100px" clearable placeholder="全部">
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
                    <el-descriptions-item label="备注" :span="2">{{ row.remarks || '暂无' }}</el-descriptions-item>
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
              <el-table-column label="操作" width="140" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openEditProductDetail(row)">编辑</el-button>
                  <el-button link type="danger" @click="handleDeleteProductDetail(row)">删除</el-button>
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

    <el-dialog
      v-model="editDialogVisible"
      title="编辑不符合规定化妆品明细"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form ref="productDetailFormRef" :model="productDetailForm" :rules="productDetailRules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="序号" prop="sequence_no">
              <el-input-number v-model="productDetailForm.sequence_no" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="产品名称" prop="product_name">
              <el-input v-model="productDetailForm.product_name" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="注册人/备案人等名称" prop="company_names">
              <el-input v-model="productDetailForm.company_names" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="注册人/备案人等地址" prop="company_addresses">
              <el-input v-model="productDetailForm.company_addresses" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="被抽样单位名称" prop="sample_unit_name">
              <el-input v-model="productDetailForm.sample_unit_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="被抽样单位地址" prop="sample_unit_address">
              <el-input v-model="productDetailForm.sample_unit_address" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="包装规格">
              <el-input v-model="productDetailForm.package_spec" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="标示批号">
              <el-input v-model="productDetailForm.batch_no" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生产日期">
              <el-input v-model="productDetailForm.production_date" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="限期使用日期/保质期">
              <el-input v-model="productDetailForm.expiry_date" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="所在地/进口地区">
              <el-input v-model="productDetailForm.product_region" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="注册/备案编号">
              <el-input v-model="productDetailForm.registration_no" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="生产许可证号">
              <el-input v-model="productDetailForm.production_license_no" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="检验机构">
              <el-input v-model="productDetailForm.inspection_institution" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="不符合规定项目" prop="unqualified_items" >
          <el-input v-model="productDetailForm.unqualified_items" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="检验结果" prop="inspection_result" >
          <el-input v-model="productDetailForm.inspection_result" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="规定要求" prop="requirement" >
          <el-input v-model="productDetailForm.requirement" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="productDetailForm.remarks" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="涉嫌假冒">
          <el-switch v-model="productDetailForm.is_counterfeit" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeEditDialog">取消</el-button>
        <el-button type="primary" :loading="savingProductDetail" @click="handleSaveProductDetail">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import {
  deleteAnnouncementProductDetail,
  getAnnouncementById,
  getAnnouncementProductDetails,
  getRelatedInspections,
  updateAnnouncementProductDetail
} from '@/api/index'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const productDetailsLoading = ref(false)
const savingProductDetail = ref(false)
const announcement = ref(null)
const relatedInspections = ref([])
const productDetails = ref([])
const editDialogVisible = ref(false)
const productDetailFormRef = ref(null)
const productDetailFilters = ref({
  unqualified_item: '',
  company_keyword: '',
  sample_unit_keyword: '',
  is_counterfeit: ''
})
const productDetailsSummary = ref(createEmptySummary())
const productDetailForm = reactive(createEmptyProductDetailForm())
const productDetailRules = {
  sequence_no: [{ required: true, message: '请输入序号', trigger: 'change' }],
  product_name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  company_names: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  company_addresses: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  sample_unit_name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  sample_unit_address: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  unqualified_items: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  inspection_result: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  requirement: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
}

function createEmptySummary () {
  return {
    total: 0,
    counterfeit_count: 0,
    filtered_total: 0,
    filtered_counterfeit_count: 0,
    has_filters: false
  }
}

function createEmptyProductDetailForm () {
  return {
    id: null,
    sequence_no: 1,
    product_name: '',
    company_names: '',
    company_addresses: '',
    sample_unit_name: '',
    sample_unit_address: '',
    package_spec: '',
    batch_no: '',
    production_date: '',
    expiry_date: '',
    product_region: '',
    registration_no: '',
    production_license_no: '',
    inspection_institution: '',
    unqualified_items: '',
    inspection_result: '',
    requirement: '',
    remarks: '',
    is_counterfeit: false
  }
}

const currentAnnouncementId = computed(() => announcement.value?.id || route.params.id)

const activeCounterfeitCount = computed(() => {
  return productDetailsSummary.value.has_filters
    ? Number(productDetailsSummary.value.filtered_counterfeit_count || 0)
    : Number(productDetailsSummary.value.counterfeit_count || 0)
})

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

const goBack = () => {
  router.push('/announcements')
}

const formatDate = (date) => {
  if (!date) return '暂无'
  const value = dayjs(date)
  return value.isValid() ? value.format('YYYY年MM月DD日') : date
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

const applyProductDetailRow = (row = {}) => {
  Object.assign(productDetailForm, createEmptyProductDetailForm(), {
    ...row,
    sequence_no: Number(row.sequence_no || 1),
    is_counterfeit: Boolean(row.is_counterfeit)
  })
}

const closeEditDialog = () => {
  editDialogVisible.value = false
  applyProductDetailRow()
  productDetailFormRef.value?.clearValidate()
}

const fetchAnnouncementOnly = async (announcementId) => {
  const res = await getAnnouncementById(announcementId)
  announcement.value = res.data
  return res.data
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
    productDetailsSummary.value = res.summary || createEmptySummary()
  } catch (error) {
    console.error('获取公告批次明细失败:', error)
    productDetails.value = []
    productDetailsSummary.value = createEmptySummary()
  } finally {
    productDetailsLoading.value = false
  }
}

const fetchAnnouncement = async () => {
  const id = route.params.id
  if (!id) {
    ElMessage.error('公告ID不存在')
    goBack()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      fetchAnnouncementOnly(id),
      fetchRelatedInspections(id),
      fetchProductDetails(id)
    ])
  } catch (error) {
    ElMessage.error('获取公告详情失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const refreshAnnouncementData = async () => {
  const announcementId = currentAnnouncementId.value
  if (!announcementId) return

  await Promise.all([
    fetchAnnouncementOnly(announcementId),
    fetchProductDetails(announcementId)
  ])
}

const handleProductDetailSearch = () => {
  if (currentAnnouncementId.value) {
    fetchProductDetails(currentAnnouncementId.value)
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

const openEditProductDetail = (row) => {
  applyProductDetailRow(row)
  editDialogVisible.value = true
}

const handleSaveProductDetail = async () => {
  if (!productDetailFormRef.value || !currentAnnouncementId.value || !productDetailForm.id) {
    return
  }

  const valid = await productDetailFormRef.value.validate().catch(() => false)
  if (!valid) {
    return
  }

  savingProductDetail.value = true
  try {
    await updateAnnouncementProductDetail(currentAnnouncementId.value, productDetailForm.id, {
      sequence_no: productDetailForm.sequence_no,
      product_name: productDetailForm.product_name,
      company_names: productDetailForm.company_names,
      company_addresses: productDetailForm.company_addresses,
      sample_unit_name: productDetailForm.sample_unit_name,
      sample_unit_address: productDetailForm.sample_unit_address,
      package_spec: productDetailForm.package_spec,
      batch_no: productDetailForm.batch_no,
      production_date: productDetailForm.production_date,
      expiry_date: productDetailForm.expiry_date,
      product_region: productDetailForm.product_region,
      registration_no: productDetailForm.registration_no,
      production_license_no: productDetailForm.production_license_no,
      inspection_institution: productDetailForm.inspection_institution,
      unqualified_items: productDetailForm.unqualified_items,
      inspection_result: productDetailForm.inspection_result,
      requirement: productDetailForm.requirement,
      remarks: productDetailForm.remarks,
      is_counterfeit: productDetailForm.is_counterfeit ? 1 : 0
    })

    ElMessage.success('批次明细更新成功')
    closeEditDialog()
    await refreshAnnouncementData()
  } catch (error) {
    console.error('更新公告批次明细失败:', error)
    ElMessage.error('更新公告批次明细失败')
  } finally {
    savingProductDetail.value = false
  }
}

const handleDeleteProductDetail = async (row) => {
  if (!currentAnnouncementId.value || !row?.id) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除“${row.product_name || '该批次明细'}”吗？删除后会同步更新不符合规定化妆品库。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )

    await deleteAnnouncementProductDetail(currentAnnouncementId.value, row.id)
    ElMessage.success('批次明细删除成功')
    await refreshAnnouncementData()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('删除公告批次明细失败:', error)
    ElMessage.error('删除公告批次明细失败')
  }
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
  flex-wrap: wrap;
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

@media (max-width: 768px) {
  .announcement-detail {
    padding: 12px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

