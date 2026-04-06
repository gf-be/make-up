<template>
  <div class="supervision-detail">
    <el-page-header @back="goBack" title="返回飞行检查列表" content="飞行检查详情" />

    <el-card v-loading="loading" class="detail-card" shadow="never">
      <template v-if="detail">
        <div class="detail-header">
          <div>
            <h1 class="detail-title">{{ detail.title || '飞行检查详情' }}</h1>
            <div class="detail-meta">
              <el-tag :type="getLevelType(detail.level)">{{ getLevelText(detail.level) }}</el-tag>
              <span>发布日期：{{ formatDate(detail.publish_date || detail.supervision_date) }}</span>
              <span>来源：{{ detail.source || '-' }}</span>
            </div>
          </div>
          <div class="detail-header__actions">
            <el-button @click="goBack">返回列表</el-button>
          </div>
        </div>

        <el-descriptions :column="2" border class="overview-descriptions">
          <el-descriptions-item label="企业汇总">
            {{ overviewCompanyName }}
          </el-descriptions-item>
          <el-descriptions-item label="涉及企业数">
            {{ totalCompanyCount }}
          </el-descriptions-item>
          <el-descriptions-item label="检查单位">
            {{ detail.inspection_unit || detail.detail_record?.inspection_unit || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="附件数量">
            {{ attachmentCount }}
          </el-descriptions-item>
          <el-descriptions-item label="企业地址" :span="2">
            {{ detail.company_address || detail.detail_record?.company_address || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="附件列表" :span="2">
            <div v-if="detail.attachments?.length" class="attachment-actions">
              <el-button
                v-for="attachment in detail.attachments"
                :key="getAttachmentKey(attachment)"
                type="primary"
                link
                @click="downloadAttachment(attachment.attachment_path)"
              >
                {{ attachment.attachment_name || '附件' }}
              </el-button>
            </div>
            <span v-else>-</span>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="detail.content" class="summary-section">
          <div class="section-title">通告摘要</div>
          <div class="section-content">{{ detail.content }}</div>
        </div>

        <div class="section-header">
          <div class="section-title">按附件解析的企业检查内容</div>
          <div class="section-tags">
            <el-tag type="info">附件 {{ attachmentCount }} 份</el-tag>
            <el-tag type="success">企业 {{ totalCompanyCount }} 家</el-tag>
          </div>
        </div>

        <el-empty
          v-if="!attachmentDetailGroups.length"
          description="暂无可展示的附件解析内容"
        />

        <div v-else class="attachment-group-list">
          <el-card
            v-for="(group, groupIndex) in attachmentDetailGroups"
            :key="getAttachmentKey(group, groupIndex)"
            class="attachment-group-card"
            shadow="never"
          >
            <template #header>
              <div class="attachment-group-card__header">
                <div class="attachment-group-card__title">
                  <span>{{ group.attachment_name || `附件${groupIndex + 1}` }}</span>
                  <el-tag size="small" type="info">第 {{ groupIndex + 1 }} 份附件</el-tag>
                  <el-tag size="small" :type="getParseStatusType(group)">
                    {{ getParseStatusText(group) }}
                  </el-tag>
                  <el-tag size="small" type="primary">
                    企业 {{ group.company_count || group.detail_rows?.length || 0 }} 家
                  </el-tag>
                </div>
                <el-button
                  v-if="group.attachment_path"
                  type="primary"
                  link
                  @click="downloadAttachment(group.attachment_path)"
                >
                  下载附件
                </el-button>
              </div>
            </template>

            <div v-if="group.parse_message" class="parse-message">
              {{ group.parse_message }}
            </div>

            <el-empty
              v-if="!group.detail_rows?.length"
              description="该附件暂无可提取的企业检查内容"
            />

            <div v-else class="company-section-list">
              <section
                v-for="(row, rowIndex) in group.detail_rows"
                :key="getRowKey(group, row, rowIndex)"
                class="company-section"
              >
                <div class="company-section__header">
                  <div>
                    <div class="company-section__title">
                      {{ row.company_name || row.title || `企业${rowIndex + 1}` }}
                    </div>
                    <div class="company-section__subtitle">
                      发布日期：{{ formatDate(row.publish_date || row.publish_date_text || detail.publish_date || detail.supervision_date) }}
                    </div>
                  </div>
                  <div class="company-section__tags">
                    <el-tag v-if="row.production_license_no" size="small" effect="plain">
                      许可证：{{ row.production_license_no }}
                    </el-tag>
                    <el-tag v-if="row.social_credit_code" size="small" effect="plain" type="success">
                      信用代码：{{ row.social_credit_code }}
                    </el-tag>
                  </div>
                </div>

                <el-descriptions :column="2" border size="small" class="company-descriptions">
                  <el-descriptions-item label="企业名称">
                    {{ row.company_name || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="检查单位">
                    {{ row.inspection_unit || detail.inspection_unit || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="企业地址" :span="2">
                    {{ row.company_address || '-' }}
                  </el-descriptions-item>
                </el-descriptions>

                <div class="text-block-grid">
                  <div class="text-block">
                    <div class="text-block__label">检查依据</div>
                    <div class="text-block__content">{{ row.inspection_basis || '-' }}</div>
                  </div>
                  <div class="text-block text-block--highlight">
                    <div class="text-block__label">检查发现缺陷和问题</div>
                    <div class="text-block__content">{{ row.defects_and_problems || detail.content || '-' }}</div>
                  </div>
                  <div class="text-block">
                    <div class="text-block__label">处理措施</div>
                    <div class="text-block__content">{{ row.handling_measures || '-' }}</div>
                  </div>
                </div>

                <div v-if="row.raw_text" class="raw-text-wrapper">
                  <div class="text-block__label">附件提取原文</div>
                  <div class="raw-text">{{ row.raw_text }}</div>
                </div>
              </section>
            </div>
          </el-card>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSupervisionDetail } from '@/api/index'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const detail = ref(null)

const buildFallbackAttachmentGroups = (record) => {
  if (!record) {
    return []
  }

  const attachments = Array.isArray(record.attachments) ? record.attachments : []
  const rows = Array.isArray(record.detail_rows) ? record.detail_rows : []
  const groups = []
  const usedRowIndexes = new Set()

  attachments.forEach((attachment, index) => {
    const matchedRows = []

    rows.forEach((row, rowIndex) => {
      if (usedRowIndexes.has(rowIndex)) {
        return
      }

      const samePath = attachment.attachment_path && row.attachment_path && attachment.attachment_path === row.attachment_path
      const sameName = !samePath && attachment.attachment_name && row.attachment_name && attachment.attachment_name === row.attachment_name

      if (samePath || sameName) {
        matchedRows.push(row)
        usedRowIndexes.add(rowIndex)
      }
    })

    groups.push({
      ...attachment,
      sort_order: attachment.sort_order || index + 1,
      company_count: matchedRows.filter(item => String(item.company_name || '').trim()).length || matchedRows.length,
      detail_rows: matchedRows
    })
  })

  rows.forEach((row, rowIndex) => {
    if (usedRowIndexes.has(rowIndex)) {
      return
    }

    groups.push({
      attachment_name: row.attachment_name || row.company_name || row.title || `企业明细${rowIndex + 1}`,
      attachment_path: row.attachment_path || '',
      parse_supported: true,
      parse_message: '',
      sort_order: groups.length + 1,
      company_count: String(row.company_name || '').trim() ? 1 : 0,
      detail_rows: [row]
    })
  })

  return groups.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
}

const attachmentDetailGroups = computed(() => {
  const groups = detail.value?.attachment_detail_groups
  if (Array.isArray(groups) && groups.length) {
    return groups
  }
  return buildFallbackAttachmentGroups(detail.value)
})

const attachmentCount = computed(() => {
  return detail.value?.attachments?.length || detail.value?.attachment_count || attachmentDetailGroups.value.length || 0
})

const totalCompanyCount = computed(() => {
  return detail.value?.company_count || attachmentDetailGroups.value.reduce((total, group) => {
    return total + (group.company_count || group.detail_rows?.length || 0)
  }, 0)
})

const overviewCompanyName = computed(() => {
  return detail.value?.company_name || detail.value?.detail_record?.company_name || (totalCompanyCount.value ? `共 ${totalCompanyCount.value} 家企业` : '-')
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getSupervisionDetail(route.params.id)
    detail.value = res.data
  } catch (error) {
    console.error('加载飞行检查详情失败:', error)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/supervisions')
}

const downloadAttachment = (attachmentPath) => {
  if (attachmentPath) {
    window.open(`http://localhost:3000${attachmentPath}`, '_blank')
  }
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-')
    return `${year}年${month}月${day}日`
  }

  return value
}

const getLevelType = (level) => {
  const map = { national: 'danger', provincial: 'warning', municipal: 'info' }
  return map[level] || 'info'
}

const getLevelText = (level) => {
  const map = { national: '国家级', provincial: '省级', municipal: '市级' }
  return map[level] || level || '-'
}

const getParseStatusType = (group) => {
  if (group?.detail_rows?.length) {
    return 'success'
  }
  return group?.parse_supported ? 'warning' : 'info'
}

const getParseStatusText = (group) => {
  if (group?.detail_rows?.length) {
    return '已解析'
  }
  return group?.parse_supported ? '未识别到内容' : '暂不支持解析'
}

const getAttachmentKey = (attachment, index = 0) => {
  return [attachment?.id, attachment?.attachment_path, attachment?.attachment_name, attachment?.sort_order, index].filter(Boolean).join('-')
}

const getRowKey = (group, row, index) => {
  return [group?.attachment_path, row?.id, row?.sequence_no, row?.company_name, index].filter(Boolean).join('-')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.supervision-detail {
  padding: 20px;
  max-width: 1280px;
  margin: 0 auto;
}

.detail-card {
  margin-top: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-title {
  margin: 0 0 12px;
  font-size: 28px;
  color: #303133;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #606266;
}

.detail-header__actions {
  display: flex;
  align-items: flex-start;
}

.overview-descriptions {
  margin-bottom: 24px;
}

.summary-section,
.company-section,
.raw-text-wrapper {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 28px 0 16px;
}

.section-title,
.text-block__label {
  font-weight: 600;
  color: #303133;
}

.section-title {
  font-size: 18px;
  border-left: 4px solid #409eff;
  padding-left: 10px;
}

.section-tags,
.attachment-actions,
.attachment-group-card__title,
.company-section__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.section-content,
.text-block__content,
.raw-text {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #606266;
}

.section-content {
  margin-top: 12px;
  padding: 16px;
  background: #f7f8fa;
  border-radius: 10px;
}

.attachment-group-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.attachment-group-card {
  border-radius: 12px;
}

.attachment-group-card__header,
.company-section__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.company-section-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.company-section {
  padding: 18px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 12px;
}

.company-section__title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.company-section__subtitle,
.parse-message {
  margin-top: 6px;
  color: #909399;
  font-size: 14px;
}

.company-descriptions {
  margin-top: 16px;
}

.text-block-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.text-block {
  padding: 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
}

.text-block--highlight {
  border-color: #f5c2c7;
  background: #fff8f8;
}

.text-block__content {
  margin-top: 10px;
}

.raw-text {
  margin-top: 10px;
  padding: 16px;
  background: #f4f6f8;
  border-radius: 10px;
  max-height: 360px;
  overflow: auto;
}

@media (max-width: 768px) {
  .supervision-detail {
    padding: 12px;
  }

  .detail-header,
  .attachment-group-card__header,
  .company-section__header,
  .section-header {
    flex-direction: column;
  }
}
</style>

