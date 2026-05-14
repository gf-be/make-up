<template>
  <div class="announcement-detail" :class="{ 'is-embedded': embedded }">
    <el-page-header v-if="!embedded" @back="goBack" title="返回公告列表" content="公告详情" />

    <el-card v-loading="loading" class="detail-card" shadow="never">
      <template v-if="announcement">
        <!-- <div class="header">
          <h1 class="title">{{ announcement.title }}</h1>
          <div class="meta">
            <el-tag :type="statusType">{{ statusText }}</el-tag>
            <el-tag effect="plain">{{ announcementProductTypeLabel }}</el-tag>
            <span class="date">{{ formatDate(announcement.publish_date) }}</span>
            <span v-if="announcement.announcement_no" class="announcement-no">
              {{ announcement.announcement_no }}
            </span>
          </div>
        </div> -->


        <!-- <el-divider /> -->

        <el-tabs v-model="detailTab" type="border-card" class="detail-main-tabs">
          <el-tab-pane label="公告详情" name="overview">
            <div class="content">
              <h3>关键信息</h3>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="产品类型" >
                  <el-space wrap >
                    <span style="min-width: 100px;">{{ announcementProductTypeLabel }}</span>
                    <!-- <el-button link type="primary" size="small" :loading="savingProductType" @click="openProductTypeDialog">修改产品类型</el-button> -->
                  </el-space>
                </el-descriptions-item>

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

              <div class="section-header">
                <h3>公告内容</h3>
                <!-- <el-button type="primary" plain size="small" :loading="savingContent" @click="openContentDialog">编辑正文</el-button> -->
              </div>
              <div class="announcement-content">{{ announcement.content || '暂无内容' }}</div>

              <div v-if="announcement.attachment_path" class="attachment">
                <h3>附件下载</h3>
                <el-button type="primary" :icon="Download" @click="downloadAttachment">
                  下载附件（{{ announcement.attachment_name || '附件' }}）
                </el-button>
              </div>

              <!-- <el-divider /> -->

              <!-- <div class="related-inspections" v-if="relatedInspections.length > 0">
                <h3>相关检查记录</h3>
                <el-table :data="relatedInspections" stripe>
                  <el-table-column prop="product_name" label="产品名称" min-width="200" />
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
              </div> -->
            </div>
          </el-tab-pane>

          <el-tab-pane label="问题产品明细" name="products">
            <div class="product-details">
              <div class="section-header">
                <!-- <h3>{{ announcementProductTypeLabel }}问题产品详细信息</h3> -->

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

              <div v-loading="productDetailsLoading" class="product-detail-table-wrap">
                <template v-if="productDetailPager.total > 0">
                  <el-table ref="productDetailTableRef" :data="productDetails" stripe>
                    <el-table-column type="expand" width="50">
                      <template #default="{ row }">
                        <el-descriptions :column="2" border size="small" class="detail-expanded">
                          <el-descriptions-item label="产品名称">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.product_name" size="small" />
                            <span v-else>{{ row.product_name || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="序号">
                            <el-input-number
                              v-if="isEditingProductDetail(row)"
                              v-model="productDetailForm.sequence_no"
                              :min="1"
                              size="small"
                              style="width: 100%"
                            />
                            <span v-else>{{ row.sequence_no || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="注册人/备案人等名称">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.company_names" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.company_names || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="注册人/备案人等地址">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.company_addresses" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.company_addresses || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="被抽样单位名称">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.sample_unit_name" size="small" />
                            <span v-else>{{ row.sample_unit_name || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="被抽样单位地址">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.sample_unit_address" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.sample_unit_address || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="生产日期">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.production_date" size="small" />
                            <span v-else>{{ row.production_date || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="限期使用日期/保质期">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.expiry_date" size="small" />
                            <span v-else>{{ row.expiry_date || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="所在地/进口地区">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.product_region" size="small" />
                            <span v-else>{{ row.product_region || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="注册/备案编号">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.registration_no" size="small" />
                            <span v-else>{{ row.registration_no || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="生产许可证号">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.production_license_no" size="small" />
                            <span v-else>{{ row.production_license_no || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="检验机构">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.inspection_institution" size="small" />
                            <span v-else>{{ row.inspection_institution || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="不符合规定项目" :span="2">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.unqualified_items" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.unqualified_items || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="检验结果">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.inspection_result" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.inspection_result || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="规定要求">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.requirement" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.requirement || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="备注" :span="2">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.remarks" type="textarea" :rows="2" size="small" />
                            <span v-else>{{ row.remarks || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="涉嫌假冒">
                            <el-switch v-if="isEditingProductDetail(row)" v-model="productDetailForm.is_counterfeit" />
                            <el-tag v-else-if="row.is_counterfeit" type="danger" size="small">涉嫌假冒</el-tag>
                            <span v-else>否</span>
                          </el-descriptions-item>
                        </el-descriptions>
                      </template>
                    </el-table-column>
                    <!-- <el-table-column prop="sequence_no" label="序号" width="70" align="center" /> -->
                    <el-table-column prop="product_name" label="产品名称" min-width="180" show-overflow-tooltip />
                    <el-table-column prop="company_names" label="注册人/备案人等名称" min-width="180" show-overflow-tooltip />
                    <!-- <el-table-column prop="sample_unit_name" label="被抽样单位" min-width="160" show-overflow-tooltip /> -->
                    <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="130" show-overflow-tooltip />
                    <el-table-column v-if="canManageProductDetails" label="操作" width="140" fixed="right" align="center">
                      <template #default="{ row }">
                        <el-button
                          link
                          type="primary"
                          :loading="savingProductDetail && isEditingProductDetail(row)"
                          @click="handleProductDetailEditAction(row)"
                        >
                          {{ isEditingProductDetail(row) ? '保存' : '编辑' }}
                        </el-button>
                        <el-button link type="danger" @click="handleDeleteProductDetail(row)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="product-detail-pagination">
                    <el-pagination
                      :current-page="productDetailPager.page"
                      :page-size="productDetailPager.limit"
                      layout="total, sizes, prev, pager, next, jumper"
                      :total="productDetailPager.total"
                      :page-sizes="[10, 20, 50, 100, 200]"
                      background
                      @current-change="handleProductDetailPageChange"
                      @size-change="handleProductDetailPageSizeChange"
                    />
                  </div>
                </template>
                <el-empty v-else-if="!productDetailsLoading" description="当前条件下暂无可展示的批次明细" />
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-empty v-else-if="embedded" description="请选择左侧通告查看详情" />
    </el-card>

    <!-- <el-dialog
      v-model="contentDialogVisible"
      :title="announcement ? `编辑正文：${announcement.title || '当前通告'}` : '编辑通告正文'"
      width="820px"
      :close-on-click-modal="false"
    >
      <div style="margin-bottom: 16px; color: #606266; line-height: 1.7;">
        保存后会同步更新当前抽检通告正文；若该通告来自导入核验工作台，也会同步回写对应临时批次正文。
      </div>
      <el-input
        v-model="contentForm.content"
        type="textarea"
        :rows="18"
        resize="vertical"
        placeholder="请输入修订后的通告正文"
      />
      <template #footer>
        <el-button @click="contentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingContent" @click="handleSaveContent">保存正文</el-button>
      </template>
    </el-dialog> -->

    <!-- <el-dialog
      v-model="productTypeDialogVisible"
      title="修改产品类型"
      width="420px"
      :close-on-click-modal="false"
    >

      <div style="margin-bottom: 16px; color: #606266; line-height: 1.7;">
        保存后会同步更新当前抽检通告、企业关联记录和问题产品数据。
      </div>
      <el-select v-model="productTypeForm.product_type" placeholder="请选择产品类型" style="width: 100%">
        <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <template #footer>
        <el-button @click="productTypeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingProductType" @click="handleSaveProductType">保存产品类型</el-button>
      </template>
    </el-dialog> -->

  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import {
  deleteAnnouncementProductDetail,
  getAnnouncementById,
  getAnnouncementProductDetails,
  getRelatedInspections,
  updateAnnouncementContent,
  updateAnnouncementProductDetail,
  updateAnnouncementProductType
} from '@/api/index'
import { canManageAnnouncementProducts } from '@/utils/auth'


import dayjs from 'dayjs'

const PRODUCT_TYPE_LABELS = {
  cosmetics: '化妆品',
  food: '食品',
  medical_device: '医疗器械',
  unknown: '未分类'
}

const props = defineProps({
  announcementId: {
    type: [String, Number],
    default: ''
  },
  embedded: {
    type: Boolean,
    default: false
  }
})

const productTypeOptions = Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label
}))

const route = useRoute()

const router = useRouter()
const detailTab = ref('overview')
const loading = ref(false)
const productDetailsLoading = ref(false)
const savingProductDetail = ref(false)
const savingProductType = ref(false)
// const savingContent = ref(false)
const announcement = ref(null)
const relatedInspections = ref([])
const productDetails = ref([])
// const contentDialogVisible = ref(false)
const productTypeDialogVisible = ref(false)
const productDetailTableRef = ref(null)
const editingProductDetailId = ref(null)
const canManageProductDetails = computed(() => canManageAnnouncementProducts())

const productDetailFilters = ref({
  unqualified_item: '',
  company_keyword: '',
  sample_unit_keyword: '',
  is_counterfeit: ''
})
const productDetailsSummary = ref(createEmptySummary())
const productDetailPager = reactive({
  page: 1,
  limit: 20,
  total: 0
})
const productTypeForm = reactive({
  product_type: 'unknown'
})
const contentForm = reactive({
  content: ''
})
const productDetailForm = reactive(createEmptyProductDetailForm())

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

const embedded = computed(() => props.embedded)
const resolvedAnnouncementId = computed(() => props.announcementId || route.params.id)
const currentAnnouncementId = computed(() => announcement.value?.id || resolvedAnnouncementId.value)
const announcementProductTypeLabel = computed(() => {
  const value = announcement.value?.product_type
  return PRODUCT_TYPE_LABELS[value] || value || '未分类'
})

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
// 编辑正文
// const openContentDialog = () => {
//   contentForm.content = announcement.value?.content || ''
//   contentDialogVisible.value = true
// }

// const handleSaveContent = async () => {
//   if (!currentAnnouncementId.value || savingContent.value) {
//     return
//   }

//   const nextContent = String(contentForm.content || '').trim()
//   if (!nextContent) {
//     ElMessage.warning('通告正文不能为空')
//     return
//   }

//   savingContent.value = true
//   try {
//     const res = await updateAnnouncementContent(currentAnnouncementId.value, {
//       content: nextContent
//     })
//     // contentDialogVisible.value = false
//     announcement.value = {
//       ...(announcement.value || {}),
//       content: res.data?.updated_content || nextContent,
//       inspection_unit: res.data?.inspection_unit ?? announcement.value?.inspection_unit, 
//       inspection_count: res.data?.inspection_count ?? announcement.value?.inspection_count
//     }
//     ElMessage.success('通告正文更新成功')
//     await fetchAnnouncementOnly(currentAnnouncementId.value)
//   } catch (error) {
//     console.error('更新公告正文失败:', error)
//     ElMessage.error('更新公告正文失败')
//   } finally {
//     savingContent.value = false
//   }
// }

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

const stopEditingProductDetail = () => {
  editingProductDetailId.value = null
  applyProductDetailRow()
}

const isEditingProductDetail = (row) => {
  return row?.id != null && String(row.id) === String(editingProductDetailId.value)
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

const fetchProductDetails = async (announcementId, opts = {}) => {
  if (opts.resetPage) {
    productDetailPager.page = 1
  }

  productDetailsLoading.value = true
  try {
    const loadOnce = () =>
      getAnnouncementProductDetails(announcementId, {
        ...productDetailFilters.value,
        page: productDetailPager.page,
        limit: productDetailPager.limit
      })

    let res = await loadOnce()
    productDetails.value = res.data || []
    productDetailsSummary.value = res.summary || createEmptySummary()
    productDetailPager.total = res.pagination ? Number(res.pagination.total || 0) : productDetails.value.length

    const limit = Math.max(1, productDetailPager.limit)
    const lastPage = Math.max(1, Math.ceil(productDetailPager.total / limit) || 1)
    if (productDetailPager.page > lastPage) {
      productDetailPager.page = lastPage
      res = await loadOnce()
      productDetails.value = res.data || []
      productDetailsSummary.value = res.summary || createEmptySummary()
      if (res.pagination) {
        productDetailPager.total = Number(res.pagination.total || 0)
      }
    }
  } catch (error) {
    console.error('获取公告批次明细失败:', error)
    productDetails.value = []
    productDetailsSummary.value = createEmptySummary()
    productDetailPager.total = 0
  } finally {
    productDetailsLoading.value = false
  }
}

const handleProductDetailPageChange = (page) => {
  productDetailPager.page = page
  if (currentAnnouncementId.value) {
    fetchProductDetails(currentAnnouncementId.value)
  }
}

const handleProductDetailPageSizeChange = (size) => {
  productDetailPager.limit = size
  productDetailPager.page = 1
  if (currentAnnouncementId.value) {
    fetchProductDetails(currentAnnouncementId.value)
  }
}

const resetDetailState = () => {
  announcement.value = null
  relatedInspections.value = []
  productDetails.value = []
  productDetailsSummary.value = createEmptySummary()
  productDetailsLoading.value = false
  productDetailPager.page = 1
  productDetailPager.total = 0
  detailTab.value = 'overview'
  stopEditingProductDetail()
}

const fetchAnnouncement = async (announcementId = resolvedAnnouncementId.value) => {
  const id = announcementId
  if (!id) {
    resetDetailState()
    if (!props.embedded) {
      ElMessage.error('公告ID不存在')
      goBack()
    }
    return
  }

  resetDetailState()

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

const openProductTypeDialog = () => {
  productTypeForm.product_type = announcement.value?.product_type || 'unknown'
  productTypeDialogVisible.value = true
}

const handleSaveProductType = async () => {
  if (!currentAnnouncementId.value || savingProductType.value) {
    return
  }

  savingProductType.value = true
  try {
    await updateAnnouncementProductType(currentAnnouncementId.value, {
      product_type: productTypeForm.product_type
    })
    productTypeDialogVisible.value = false
    ElMessage.success('产品类型更新成功')
    await refreshAnnouncementData()
  } catch (error) {
    console.error('更新公告产品类型失败:', error)
    ElMessage.error('更新公告产品类型失败')
  } finally {
    savingProductType.value = false
  }
}

const handleProductDetailSearch = () => {
  if (!currentAnnouncementId.value) return
  fetchProductDetails(currentAnnouncementId.value, { resetPage: true })
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

const openEditProductDetail = async (row) => {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }
  applyProductDetailRow(row)
  editingProductDetailId.value = row?.id || null
  await nextTick()
  productDetailTableRef.value?.toggleRowExpansion(row, true)
}

const validateProductDetailForm = () => {
  const requiredFields = [
    ['sequence_no', '请输入序号'],
    ['product_name', '请输入产品名称'],
    ['company_names', '请输入注册人/备案人等名称'],
    ['company_addresses', '请输入注册人/备案人等地址'],
    ['sample_unit_name', '请输入被抽样单位名称'],
    ['sample_unit_address', '请输入被抽样单位地址'],
    ['unqualified_items', '请输入不符合规定项目'],
    ['inspection_result', '请输入检验结果'],
    ['requirement', '请输入规定要求']
  ]
  for (const [field, message] of requiredFields) {
    if (productDetailForm[field] === null || productDetailForm[field] === undefined || String(productDetailForm[field]).trim() === '') {
      ElMessage.warning(message)
      return false
    }
  }
  return true
}

const handleProductDetailEditAction = (row) => {
  if (isEditingProductDetail(row)) {
    handleSaveProductDetail()
    return
  }
  openEditProductDetail(row)
}

const handleSaveProductDetail = async () => {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }
  if (!currentAnnouncementId.value || !productDetailForm.id) {
    return
  }

  if (!validateProductDetailForm()) {
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
    stopEditingProductDetail()
    await refreshAnnouncementData()
  } catch (error) {
    console.error('更新公告批次明细失败:', error)
    ElMessage.error('更新公告批次明细失败')
  } finally {
    savingProductDetail.value = false
  }
}

const handleDeleteProductDetail = async (row) => {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无删除权限')
    return
  }
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

watch(resolvedAnnouncementId, (id) => {
  fetchAnnouncement(id)
}, {
  immediate: true
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

.announcement-detail.is-embedded {
  padding: 0;
  max-width: none;
  margin: 0;
}

.announcement-detail.is-embedded .detail-card {
  margin-top: 0;
  border: 0;
}

.detail-main-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.detail-main-tabs :deep(.el-tabs__content) {
  padding: 16px 18px;
}

.detail-main-tabs .product-details {
  margin-top: 0;
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
  padding: 1px 0;
}

.content h3 {
  font-size: 18px;
  color: #303133;
  margin: 6px 0 8px 0;
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

.product-detail-table-wrap {
  min-height: 160px;
}

.product-detail-pagination {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
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

