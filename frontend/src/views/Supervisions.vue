<template>
  <div class="supervisions">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>化妆品飞行检查通告</span>
          <el-button type="primary" @click="showUploadDialog = true">
            <el-icon><Upload /></el-icon>
            上传通告
          </el-button>
        </div>
      </template>

      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-item total">
            <div class="stat-value">{{ stats.total || 0 }}</div>
            <div class="stat-label">通告总数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item national">
            <div class="stat-value">{{ stats.national || 0 }}</div>
            <div class="stat-label">国家级</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item provincial">
            <div class="stat-value">{{ stats.provincial || 0 }}</div>
            <div class="stat-label">省级</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item municipal">
            <div class="stat-value">{{ stats.municipal || 0 }}</div>
            <div class="stat-label">市级</div>
          </div>
        </el-col>
      </el-row>

      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="级别">
          <el-select v-model="filters.level" style="width: 240px" placeholder="选择级别" clearable @change="handleSearch">
            <el-option label="国家级" value="national" />
            <el-option label="省级" value="provincial" />
            <el-option label="市级" value="municipal" />
          </el-select>
        </el-form-item>
        <el-form-item label="企业名称">
          <el-input v-model="filters.company_name" placeholder="输入企业名称" clearable @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="检查单位">
          <el-input v-model="filters.inspection_unit" placeholder="输入检查单位" clearable @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="搜索企业、许可证号、问题或措施" clearable @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="company_name" label="企业名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="company_count" label="涉及企业数" width="100" align="center" />
        <el-table-column prop="attachment_count" label="附件数" width="90" align="center" />
        <el-table-column prop="production_license_no" label="生产许可证编号" min-width="180" show-overflow-tooltip />
        <el-table-column prop="company_address" label="企业地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="inspection_unit" label="检查单位" min-width="180" show-overflow-tooltip />
        <el-table-column prop="level" label="级别" width="90" align="center">

          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)" size="small">
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publish_date" label="发布日期" width="120">
          <template #default="{ row }">
            {{ row.publish_date || row.supervision_date || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="defects_and_problems" label="检查发现缺陷和问题" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">
              查看详情
            </el-button>
            <el-button v-if="row.attachment_count > 0 || row.attachment_path" link type="success" @click="openAttachments(row)">
              {{ row.attachment_count > 1 ? '查看附件' : '下载附件' }}
            </el-button>
            <el-button
              link
              type="danger"
              :loading="deletingId === row.id"
              @click="handleDelete(row)"
            >
              删除
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

    <el-dialog v-model="showUploadDialog" title="上传飞行检查通告" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="通告标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入通告标题" />
        </el-form-item>
        <el-form-item label="发布日期" prop="publish_date">
          <el-date-picker
            v-model="form.publish_date"
            type="date"
            placeholder="选择发布日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="级别" prop="level">
          <el-select v-model="form.level" placeholder="选择级别" style="width: 100%">
            <el-option label="国家级" value="national" />
            <el-option label="省级" value="provincial" />
            <el-option label="市级" value="municipal" />
          </el-select>
        </el-form-item>
        <el-form-item label="通告内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="请输入飞行检查通告内容，系统将自动提取企业名称、检查单位等信息"
          />
        </el-form-item>
        <el-form-item label="附件">
          <el-upload
            :auto-upload="false"
            :limit="20"
            :file-list="uploadFileList"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            @change="handleFileChange"
            @remove="handleFileRemove"
            @exceed="handleFileExceed"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持一次上传多个 PDF、Word、Excel 附件；系统会逐个提取企业信息并写入 `companies` 表
              </div>
            </template>
          </el-upload>
          <div v-if="form.files.length" class="file-info">
            已选择 {{ form.files.length }} 个附件：{{ form.files.map(file => file.name).join('、') }}
          </div>
        </el-form-item>

      </el-form>

      <el-divider>自动提取的关键信息</el-divider>
      <el-descriptions :column="2" border v-if="extractedInfo.company_name || extractedInfo.inspection_unit || extractedInfo.publish_date || form.files.length">
        <el-descriptions-item label="企业名称">{{ extractedInfo.company_name || '待上传后识别' }}</el-descriptions-item>
        <el-descriptions-item label="检查单位">{{ extractedInfo.inspection_unit || '待上传后识别' }}</el-descriptions-item>
        <el-descriptions-item label="发布日期">{{ extractedInfo.publish_date || '待上传后识别' }}</el-descriptions-item>
        <el-descriptions-item label="生产许可证号">{{ extractedInfo.production_license_no || '待上传后识别' }}</el-descriptions-item>
        <el-descriptions-item label="已选附件数">{{ form.files.length || 0 }}</el-descriptions-item>
        <el-descriptions-item label="涉及企业数">{{ extractedInfo.company_count || '待上传后识别' }}</el-descriptions-item>
      </el-descriptions>


      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">上传并发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createSupervision, getSupervisions, getSupervisionStats, deleteSupervision } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'


const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const uploading = ref(false)
const deletingId = ref(null)
const showUploadDialog = ref(false)
const tableData = ref([])

const stats = ref({})
const filters = ref({
  level: '',
  company_name: '',
  inspection_unit: '',
  keyword: ''
})
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})
const uploadFileList = ref([])
const form = reactive({
  title: '',
  publish_date: '',
  level: 'national',
  content: '',
  files: []
})
const extractedInfo = reactive({
  company_name: '',
  inspection_unit: '',
  publish_date: '',
  production_license_no: '',
  company_count: ''
})


const rules = {
  level: [{ required: true, message: '请选择级别', trigger: 'change' }]
}


watch(() => form.content, (value) => {
  extractedInfo.company_name = extractValue(value, /企业名称\s*[:：]?\s*([^\n]+)/)
  extractedInfo.inspection_unit = extractValue(value, /检查单位\s*[:：]?\s*([^\n]+)/)
  extractedInfo.publish_date = extractValue(value, /发布日期\s*[:：]?\s*([^\n]+)/)
  extractedInfo.production_license_no = extractValue(value, /化妆品生产许可证编号\s*[:：]?\s*([^\n]+)/)
  extractedInfo.company_count = extractedInfo.company_name ? 1 : ''
})


function extractValue(text, regex) {
  const match = String(text || '').match(regex)
  return match ? match[1].trim() : ''
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getSupervisions({
      ...filters.value,
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    tableData.value = res.data || []
    pagination.value.total = res.pagination?.total || 0
  } catch (error) {
    console.error('加载飞行检查通告失败:', error)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getSupervisionStats()
    stats.value = res.data || {}
  } catch (error) {
    console.error('加载飞行检查统计失败:', error)
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  loadData()
}

const resetFilters = () => {
  filters.value = {
    level: '',
    company_name: '',
    inspection_unit: '',
    keyword: ''
  }
  pagination.value.page = 1
  loadData()
}

const handleFileChange = (_file, fileList) => {
  uploadFileList.value = fileList
  form.files = fileList.map(item => item.raw).filter(Boolean)
}

const handleFileRemove = (_file, fileList) => {
  uploadFileList.value = fileList
  form.files = fileList.map(item => item.raw).filter(Boolean)
}

const handleFileExceed = () => {
  ElMessage.warning('最多可上传 20 个附件')
}

const resetForm = () => {
  form.title = ''
  form.publish_date = ''
  form.level = 'national'
  form.content = ''
  form.files = []
  uploadFileList.value = []
  extractedInfo.company_name = ''
  extractedInfo.inspection_unit = ''
  extractedInfo.publish_date = ''
  extractedInfo.production_license_no = ''
  extractedInfo.company_count = ''
  formRef.value?.resetFields()
}

const handleUpload = async () => {
  if (!formRef.value) return

  if (!form.files.length && !form.content.trim()) {
    ElMessage.warning('请至少填写通告内容或上传附件')
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    uploading.value = true
    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('publish_date', form.publish_date)
      formData.append('level', form.level)
      formData.append('content', form.content)
      formData.append('status', 'ongoing')
      form.files.forEach(file => {
        formData.append('attachments', file)
      })

      const res = await createSupervision(formData)
      const parsedCount = res?.data?.parsed_detail_count || 0
      const attachmentCount = res?.data?.attachment_count || form.files.length || 0
      const syncedCompanyCount = res?.data?.synced_company_count || 0

      extractedInfo.company_name = res?.data?.extracted_info?.company_name || extractedInfo.company_name
      extractedInfo.inspection_unit = res?.data?.extracted_info?.inspection_unit || extractedInfo.inspection_unit
      extractedInfo.publish_date = res?.data?.extracted_info?.publish_date || extractedInfo.publish_date
      extractedInfo.company_count = syncedCompanyCount || extractedInfo.company_count

      ElMessage.success(
        `飞行检查通告上传成功，已上传 ${attachmentCount} 个附件，解析 ${parsedCount} 条明细，同步 ${syncedCompanyCount} 家企业`
      )

      showUploadDialog.value = false
      resetForm()
      await Promise.all([loadData(), loadStats()])
    } catch (error) {
      console.error('上传飞行检查通告失败:', error)
      ElMessage.error('上传飞行检查通告失败')
    } finally {
      uploading.value = false
    }
  })
}

const viewDetail = (id) => {
  router.push(`/supervisions/${id}`)
}

const downloadAttachment = (row) => {
  if (row.attachment_path) {
    window.open(`http://localhost:3000${row.attachment_path}`, '_blank')
  }
}

const openAttachments = (row) => {
  if ((row.attachment_count || 0) > 1) {
    viewDetail(row.id)
    return
  }

  downloadAttachment(row)
}

const handleDelete = async (row) => {
  if (!row?.id || deletingId.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除“${row.title || '该通告'}”吗？删除后将同步清理该通告关联的企业及明细数据。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )

    deletingId.value = row.id
    await deleteSupervision(row.id)

    if (tableData.value.length === 1 && pagination.value.page > 1) {
      pagination.value.page -= 1
    }

    await Promise.all([loadData(), loadStats()])
    ElMessage.success('飞行检查通告删除成功')
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }

    console.error('删除飞行检查通告失败:', error)
    ElMessage.error('删除飞行检查通告失败')
  } finally {
    if (deletingId.value === row?.id) {
      deletingId.value = null
    }
  }
}

const getLevelType = (level) => {

  const map = { national: 'danger', provincial: 'warning', municipal: 'info' }
  return map[level] || 'info'
}

const getLevelText = (level) => {
  const map = { national: '国家级', provincial: '省级', municipal: '市级' }
  return map[level] || level || '-'
}

onMounted(() => {
  loadStats()
  loadData()
})
</script>

<style scoped>
.supervisions {
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

.stats-row {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  color: white;
}

.stat-item.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-item.national {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-item.provincial {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-item.municipal {
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

.file-info {
  margin-top: 8px;
  color: #67c23a;
  font-size: 14px;
}
</style>
