<template>
  <div class="company-detail" v-loading="loading">
    <el-card v-if="detail">
      <template #header>
        <div class="card-header">
          <span>{{ detail.company.name }}</span>
          <div class="header-actions">
            <!-- 新增被企业投诉内容 -->
            <el-button type="primary" @click="showComplaintModal">
              新增投诉
            </el-button>
            <el-button @click="$router.back()">返回</el-button>
          </div>
        </div>
      </template>

      <!-- 企业基本信息 -->
      <el-descriptions :column="3" border>
        <el-descriptions-item label="企业名称">
          {{ detail.company.name }}
        </el-descriptions-item>
        <el-descriptions-item label="统一社会信用代码">
          {{ detail.company.credit_code || '-' }}
        </el-descriptions-item>
        <!-- <el-descriptions-item label="品牌">
          {{ detail.company.brand || '-' }}
        </el-descriptions-item> -->
        <el-descriptions-item label="类型">
          <el-tag :type="getTypeType(detail.company.type)">
            {{ getTypeText(detail.company.type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="投诉状态">
          <el-tag :type="detail.company.is_complained ? 'danger' : 'success'">
            {{ detail.company.is_complained ? '已被投诉' : '暂无投诉' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="省份">
          {{ detail.company.province || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="城市">
          {{ detail.company.city || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="地址">
          {{ detail.company.address || '-' }}
        </el-descriptions-item>
      </el-descriptions>

    
      <!-- 检查历史 -->
      <div class="history-section">
        <h3>检查历史记录</h3>
        <el-alert
          v-if="detail.history_meta?.truncated"
          type="info"
          :closable="false"
          show-icon
          class="history-truncated-tip"
          title="历史记录较多，当前仅返回最近条目（单次最多 10000 条）；完整数据请走导出或分页接口。"
        />
        <el-table :data="detail.history" stripe border>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="title" label="检查批次" min-width="200" show-overflow-tooltip />
          <el-table-column prop="source_type" label="来源" width="120">
            <template #default="{ row }">
              {{ getSourceTypeText(row.source_type) }}
            </template>
          </el-table-column>

          <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip />
          <!-- <el-table-column prop="brand" label="品牌" width="120" /> -->
          <!-- {{ formatDate(currentRow.publish_date) || '-' }} -->
          <el-table-column prop="inspection_date" label="检查日期" width="110" >
            <!-- {{ formatDate(currentRow.publish_date) || '-' }} -->
            <template #default="{ row }">
              {{ formatDate(row.inspection_date) || '-' }}
            </template>
          </el-table-column>
          <!-- <el-table-column prop="level" label="级别" width="80">
            <template #default="{ row }">
              <el-tag :type="getLevelType(row.level)" size="small">
                {{ getLevelText(row.level) }}
              </el-tag>
            </template>
          </el-table-column> -->
          <!-- <el-table-column prop="inspection_result" label="检查结果" width="90">
            <template #default="{ row }">
              <el-tag :type="getResultType(row.inspection_result)" size="small">
                {{ getResultText(row.inspection_result) }}
              </el-tag>
            </template>
          </el-table-column> -->
          <el-table-column prop="unqualified_items" label="不合格项目" min-width="150" show-overflow-tooltip />
        </el-table>
      </div>


      <!-- 投诉记录 -->
      <div class="complaint-section">
        <h3>投诉记录</h3>
        <el-table :data="detail.complaints || []" stripe border>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="complaint_date" label="投诉日期" width="120">
            <template #default="{ row }">
              {{ formatDate(row.complaint_date) }}
            </template>
          </el-table-column>
          <el-table-column prop="complaint_content" label="投诉内容" min-width="150" show-overflow-tooltip />
          <!-- <el-table-column prop="complaint_result" label="" width="90"/> -->
        </el-table>
      </div>
    </el-card>

    <el-dialog
      v-model="complaintDialogVisible"
      title="新增投诉记录"
      width="520px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="投诉日期">
          <el-date-picker
            v-model="complaintForm.complaint_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="请选择投诉日期"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="投诉内容" required>
          <el-input
            v-model="complaintForm.complaint_content"
            type="textarea"
            :rows="5"
            maxlength="1000"
            show-word-limit
            placeholder="请输入投诉内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="complaintDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingComplaint" @click="submitComplaint">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { createCompanyComplaint, getCompanyDetail } from '@/api/index'

const route = useRoute()
const loading = ref(false)
const detail = ref(null)
const complaintDialogVisible = ref(false)
const savingComplaint = ref(false)
const complaintForm = ref({
  complaint_content: '',
  complaint_date: ''
})

function formatTodayDate() {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}


const loadData = async () => {
  loading.value = true
  try {
    const res = await getCompanyDetail(route.params.id, { history_limit: 10000 })
    detail.value = res.data
    console.log(detail.value);
  } catch (error) {
    console.error('加载详情失败:', error)
  } finally {
    loading.value = false
  }
}

const showComplaintModal = () => {
  complaintForm.value = {
    complaint_content: '',
    complaint_date: formatTodayDate()
  }
  complaintDialogVisible.value = true
}

const submitComplaint = async () => {
  const content = String(complaintForm.value.complaint_content || '').trim()
  if (!content) {
    ElMessage.warning('请输入投诉内容')
    return
  }

  savingComplaint.value = true
  try {
    const payload = { complaint_content: content }
    const complaintDate = String(complaintForm.value.complaint_date || '').trim()
    if (complaintDate) {
      payload.complaint_date = complaintDate
    }

    await createCompanyComplaint(route.params.id, payload)
    ElMessage.success('投诉记录已保存')
    complaintDialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存投诉记录失败')
  } finally {
    savingComplaint.value = false
  }
}


const getTypeType = (type) => {
  const map = { manufacturer: 'primary', distributor: 'success', seller: 'info' }
  return map[type] || 'info'
}

const getTypeText = (type) => {
  const map = { manufacturer: '生产企业', distributor: '经销商', seller: '销售商' }
  return map[type] || type
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

const getSourceTypeText = (sourceType) => {
  const map = {
    announcement: '抽检通告',
    inspection: '抽样检查',
    supervision: '飞行检查'
  }
  return map[sourceType] || sourceType || '-'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.company-detail {
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

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.history-truncated-tip {
  margin-bottom: 12px;
}

.stats-row {
  margin-top: 20px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.stat-item.product {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-item.qualified {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-item.unqualified {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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

.mt-20 {
  margin-top: 20px;
}

.percentage-value {
  display: block;
  font-size: 28px;
  font-weight: bold;
}

.percentage-label {
  display: block;
  font-size: 14px;
  opacity: 0.8;
}

.result-distribution {
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
}

.result-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  min-width: 120px;
}

.result-item.qualified {
  background: #f0f9ff;
  color: #67c23a;
}

.result-item.unqualified {
  background: #fef0f0;
  color: #f56c6c;
}

.result-label {
  font-size: 14px;
  margin-bottom: 8px;
  opacity: 0.8;
}

.result-value {
  font-size: 32px;
  font-weight: bold;
}

.history-section {
  margin-top: 30px;
}

.history-section h3,
.complaint-section h3 {
  margin-bottom: 15px;
  color: #303133;
}

.complaint-section {
  margin-top: 30px;
}
</style>
