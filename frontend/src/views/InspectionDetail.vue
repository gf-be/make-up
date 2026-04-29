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
        <div class="section-header">
          <h3>检查摘要</h3>
          <el-button
            type="warning"
            plain
            size="small"
            :disabled="!canGenerateCopy"
            @click="openCopyDialog"
          >
            生成文案
          </el-button>
        </div>
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

    <el-dialog
      v-model="copyDialogVisible"
      title="视频文案"
      width="min(820px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
    >
      <div class="copy-dialog-body">
        <el-input
          v-model="copyText"
          type="textarea"
          :rows="16"
          readonly
          resize="vertical"
          placeholder="点击“生成文案”后将在这里显示"
        />
      </div>
      <template #footer>
        <el-button @click="copyDialogVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="!copyText" @click="copyGeneratedText">复制文案</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getInspectionDetail } from '@/api'

const route = useRoute()
const loading = ref(false)
const detail = ref(null)
const copyDialogVisible = ref(false)
const copyText = ref('')

const canGenerateCopy = computed(() => {
  const rows = detail.value?.details || []
  return Boolean(detail.value?.summary || rows.length)
})

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

const copyTextValue = (value) => {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text || ['nan', 'none', 'null', 'undefined'].includes(text.toLowerCase())) return ''
  return text
}

const normalizeCopyText = (value) => {
  return copyTextValue(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+/g, '；').trim()
}

const uniqueCopyValues = (values = []) => {
  const seen = new Set()
  const out = []
  values.forEach((raw) => {
    const value = normalizeCopyText(raw)
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
  })
  return out
}

const formatCopyList = (items, max = 6) => {
  const list = (items || []).filter(Boolean)
  if (!list.length) return ''
  const head = list.slice(0, max).join('、')
  return list.length > max ? `${head}等` : head
}

const shortForVoice = (value, maxLen = 72) => {
  const text = normalizeCopyText(value)
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text
}

const issuesForVoice = (value, maxLen = 96) => {
  return shortForVoice(uniqueCopyValues(splitIssueItems(value)).join('、'), maxLen)
}

const splitIssueItems = (value) => {
  return normalizeCopyText(value)
    .replace(/;/g, '；')
    .replace(/,/g, '，')
    .split(/[；;，,、\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

const getTopIssueItem = (rows = []) => {
  const counts = new Map()
  rows.forEach((row) => {
    uniqueCopyValues(splitIssueItems(row?.unqualified_items)).forEach((item) => {
      counts.set(item, (counts.get(item) || 0) + 1)
    })
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .map(([item]) => item)[0] || ''
}

const regionForSampling = (rawAddress) => {
  const address = copyTextValue(rawAddress)
  if (!address) return ''
  for (const city of ['北京市', '上海市', '天津市', '重庆市']) {
    if (address.startsWith(city)) return city
  }
  const cityMatch = address.match(/^(.+?市)/)
  if (cityMatch && cityMatch[1].length <= 24) return cityMatch[1]
  const leagueMatch = address.match(/^(.+?盟)/)
  if (leagueMatch && leagueMatch[1].length <= 24) return leagueMatch[1]
  const prefectureMatch = address.match(/^(.+?自治州)/)
  if (prefectureMatch && prefectureMatch[1].length <= 28) return prefectureMatch[1]
  return address.length <= 16 ? address : `${address.slice(0, 14)}…`
}

const getUnqualifiedRows = () => {
  const rows = detail.value?.details || []
  return rows.filter((row) => row?.inspection_result === 'unqualified' || copyTextValue(row?.unqualified_items))
}

const pickCopyRows = (rows, max = 6) => {
  return [...(rows || [])]
    .sort((a, b) => {
      const aScore = (copyTextValue(a?.product_name) ? 2 : 0) + (copyTextValue(a?.unqualified_items) ? 2 : 0) + (copyTextValue(a?.manufacturer) ? 1 : 0)
      const bScore = (copyTextValue(b?.product_name) ? 2 : 0) + (copyTextValue(b?.unqualified_items) ? 2 : 0) + (copyTextValue(b?.manufacturer) ? 1 : 0)
      return bScore - aScore
    })
    .slice(0, max)
}

const buildProductLine = (row, issueItem = '') => {
  const product = copyTextValue(row?.product_name)
  const producer = copyTextValue(row?.manufacturer)
  const region = regionForSampling(row?.sample_source)
  const issues = issueItem || issuesForVoice(row?.unqualified_items)
  const head = producer && product
    ? `由${producer}生产的${product}`
    : (product || (producer ? `${producer}相关批次产品` : '有关产品'))
  const middle = region ? `在${region}抽检时` : '在本次抽检环节中'
  const tail = issues ? `检出${issues}不符合要求` : '检出情况见检查详情'
  return `${head}，${middle}，${tail}。`
}

const buildInspectionCopyText = () => {
  const rows = detail.value?.details || []
  const unqualifiedRows = getUnqualifiedRows()
  const topIssue = getTopIssueItem(unqualifiedRows)
  const topIssueRows = topIssue
    ? unqualifiedRows.filter((row) => splitIssueItems(row?.unqualified_items).includes(topIssue))
    : []
  const selectedRows = pickCopyRows(topIssueRows.length ? topIssueRows : (unqualifiedRows.length ? unqualifiedRows : rows))
  const title = copyTextValue(detail.value?.title) || '本次抽检'
  const region = copyTextValue(detail.value?.region)
  const unit = copyTextValue(detail.value?.inspection_unit)
  const source = copyTextValue(detail.value?.source)
  const total = Number(detail.value?.total_samples || rows.length || 0)
  const unqualifiedCount = Number(detail.value?.unqualified_count || unqualifiedRows.length || 0)
  const qualifiedCount = Number(detail.value?.qualified_count || Math.max(total - unqualifiedCount, 0))
  const issues = topIssue ? [shortForVoice(topIssue, 96)] : []
  const products = uniqueCopyValues(unqualifiedRows.map((row) => row?.product_name))
  const producers = uniqueCopyValues(unqualifiedRows.map((row) => row?.manufacturer))
  const regions = uniqueCopyValues(rows.map((row) => regionForSampling(row?.sample_source)).filter(Boolean))
  const contextParts = [region, unit, source].filter(Boolean)

  const lines = [
    `据本次资料梳理，${title}共涉及样本 ${total} 批次，其中合格 ${qualifiedCount} 批次、不合格 ${unqualifiedCount} 批次。`,
    `根据${formatCopyList(contextParts, 3) || title}，本次共发现${formatCopyList(issues, 8) || '相关指标异常'}等情况，涵盖${formatCopyList(products, 6) || '相关产品'}等产品，样本主要分布在${formatCopyList(regions, 5) || region || '通报所列区域'}，涉及生产企业${formatCopyList(producers, 5) || '详见检查详情'}等。`
  ]

  if (selectedRows.length) {
    lines.push(`以下按通报节选 ${selectedRows.length} 个典型产品，口播时可按序号稍作停顿：`)
    selectedRows.forEach((row, index) => {
      lines.push(`${index + 1}. ${buildProductLine(row, issues[0])}`)
    })
  }

  return lines.join('\n')
}

const openCopyDialog = () => {
  if (!canGenerateCopy.value) {
    ElMessage.warning('当前没有可生成文案的内容')
    return
  }
  copyText.value = buildInspectionCopyText()
  copyDialogVisible.value = true
}

const copyGeneratedText = async () => {
  if (!copyText.value) return
  try {
    await navigator.clipboard.writeText(copyText.value)
    ElMessage.success('文案已复制')
  } catch (error) {
    console.error('复制文案失败:', error)
    ElMessage.error('复制失败，请手动选择文本复制')
  }
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

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 15px;
}

.section-header h3 {
  margin-bottom: 0;
}

.summary {
  line-height: 1.8;
  color: #606266;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 4px;
}

.copy-dialog-body :deep(.el-textarea__inner) {
  line-height: 1.8;
  font-size: 15px;
}
</style>
