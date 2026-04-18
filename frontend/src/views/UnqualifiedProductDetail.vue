<template>
  <div class="unqualified-product-detail" v-loading="loading">
    <el-page-header @back="goBack" title="返回问题产品列表" content="问题产品详情" />

    <el-card v-if="detail" class="detail-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">{{ detail.product_name || '问题产品详情' }}</div>
            <div class="subtitle">{{ detail.source_title || detail.batch_title || '来源通告' }}</div>
          </div>
          <div class="header-actions">
            <el-button v-if="detail.company_id" @click="goCompany">企业详情</el-button>
            <el-button type="primary" @click="goSource">查看来源</el-button>
          </div>
        </div>
      </template>

      <div class="tag-row">
        <el-tag type="info">{{ detail.product_type_label || '-' }}</el-tag>
        <el-tag type="success">{{ detail.announcement_type_label || '-' }}</el-tag>
        <el-tag>{{ detail.source_publish_date || '无日期' }}</el-tag>
        <el-tag v-if="detail.province_display" type="warning">{{ detail.province_display }}</el-tag>
      </div>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="来源类型">{{ detail.source_type === 'supervision' ? '飞行检查' : '抽检通告' }}</el-descriptions-item>
        <el-descriptions-item label="来源标题">{{ detail.source_title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通告编号">{{ detail.announcement_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发布日期">{{ detail.source_publish_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="企业名称">{{ detail.company_names || '-' }}</el-descriptions-item>
        <el-descriptions-item label="企业地址">{{ detail.company_addresses || '-' }}</el-descriptions-item>
        <el-descriptions-item label="被抽样单位">{{ detail.sample_unit_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="被抽样单位地址">{{ detail.sample_unit_address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="产品分类">{{ detail.product_category || '-' }}</el-descriptions-item>
        <el-descriptions-item label="问题类型">{{ detail.issue_category || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所在省份">{{ detail.province_display || '-' }}</el-descriptions-item>
        <el-descriptions-item label="检验/检查机构">{{ detail.inspection_institution || detail.supervision_unit || '-' }}</el-descriptions-item>
        <el-descriptions-item label="包装规格">{{ detail.package_spec || '-' }}</el-descriptions-item>
        <el-descriptions-item label="标示批号">{{ detail.batch_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生产日期">{{ detail.production_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="限期使用日期/保质期">{{ detail.expiry_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="注册/备案编号">{{ detail.registration_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生产许可证号">{{ detail.production_license_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="不符合规定项目" :span="2">{{ detail.unqualified_items || '-' }}</el-descriptions-item>
        <el-descriptions-item label="检验结果/处理措施" :span="2">{{ detail.inspection_result || '-' }}</el-descriptions-item>
        <el-descriptions-item label="依据/规定要求" :span="2">{{ detail.requirement || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remarks || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="section-grid">
        <el-card shadow="never">
          <template #header>
            <div class="section-title">问题项目拆分</div>
          </template>
          <div class="chip-wrap">
            <el-tag v-for="item in detail.issue_items || []" :key="item" type="danger">{{ item }}</el-tag>
            <span v-if="!(detail.issue_items || []).length" class="muted-text">暂无拆分项目</span>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="section-title">产品分类拆分</div>
          </template>
          <div class="chip-wrap">
            <el-tag v-for="item in detail.product_categories || []" :key="item" type="success">{{ item }}</el-tag>
            <span v-if="!(detail.product_categories || []).length" class="muted-text">暂无分类</span>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUnqualifiedProductDetail } from '@/api/index'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const detail = ref(null)

async function loadData() {
  loading.value = true
  try {
    const res = await getUnqualifiedProductDetail(route.params.id)
    detail.value = res.data || null
  } catch (error) {
    console.error('加载问题产品详情失败:', error)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/unqualified-products')
}

function goSource() {
  if (!detail.value) return
  if (detail.value.announcement_id) {
    router.push(`/announcements/${detail.value.announcement_id}`)
    return
  }
  if (detail.value.supervision_id) {
    router.push(`/supervisions/${detail.value.supervision_id}`)
  }
}

function goCompany() {
  if (detail.value?.company_id) {
    router.push(`/companies/${detail.value.company_id}`)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.unqualified-product-detail {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px;
}

.detail-card {
  margin-top: 20px;
  border-radius: 18px;
}

.card-header,
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.subtitle {
  margin-top: 6px;
  color: #909399;
}

.tag-row,
.chip-wrap {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tag-row {
  margin-bottom: 18px;
}

.section-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.muted-text {
  color: #909399;
}

@media (max-width: 768px) {
  .unqualified-product-detail {
    padding: 12px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-grid {
    grid-template-columns: 1fr;
  }
}
</style>
