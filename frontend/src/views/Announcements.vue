<template>
  <div class="announcements">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>抽样检查公告</span>
          <el-button type="primary" @click="showUploadDialog = true">
            <el-icon><Upload /></el-icon>
            上传公告
          </el-button>
        </div>
      </template>

      <!-- 筛选栏 -->
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" style="width: 240px" placeholder="选择状态" clearable @change="loadData">
            <el-option label="已发布" value="published" />
            <el-option label="草稿" value="draft" />
            <el-option label="已归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="搜索标题或内容" clearable @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="title" label="标题" min-width="250" show-overflow-tooltip />
        <el-table-column prop="announcement_no" label="公告编号" width="150" />
        <el-table-column prop="inspection_unit" label="检验单位" width="200" show-overflow-tooltip />
        <el-table-column prop="inspection_count" label="抽检批次" width="100" align="center" />
        <el-table-column prop="publish_date" label="发布日期" width="120" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="view_count" label="浏览量" width="80" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">
              查看详情
            </el-button>
            <el-button
              v-if="row.attachment_path"
              link
              type="success"
              @click="downloadAttachment(row)"
            >
              下载附件
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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

    <!-- 上传对话框 -->
    <el-dialog v-model="showUploadDialog" title="上传抽样检查公告" width="700px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="公告标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入公告标题" />
        </el-form-item>
        <el-form-item label="公告编号" prop="announcement_no">
          <el-input v-model="form.announcement_no" placeholder="如：2026年第6号" />
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
        <el-form-item label="公告内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="请输入公告内容，系统将自动提取检验单位、批次数量等关键信息"
          />
        </el-form-item>
        <el-form-item label="附件">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            @change="handleFileChange"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF、Word、Excel 文件，大小不超过 10MB，其中 Word/Excel 会自动解析批次明细并入库
              </div>

            </template>
          </el-upload>
          <div v-if="form.file" class="file-info">
            已选择: {{ form.file.name }}
          </div>
        </el-form-item>
      </el-form>

      <!-- 自动提取信息展示 -->
      <el-divider>自动提取的关键信息</el-divider>
      <el-descriptions :column="2" border v-if="extractedInfo.inspection_unit || extractedInfo.inspection_count">
        <el-descriptions-item label="检验单位">
          {{ extractedInfo.inspection_unit || '未识别' }}
        </el-descriptions-item>
        <el-descriptions-item label="抽检批次">
          {{ extractedInfo.inspection_count || '未识别' }}
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading">
          上传并发布
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { getAnnouncements, createAnnouncement } from '@/api/index'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const filters = ref({
  status: 'published',
  keyword: ''
})
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})

// 上传表单
const showUploadDialog = ref(false)
const uploading = ref(false)
const formRef = ref(null)
const form = reactive({
  title: '',
  announcement_no: '',
  publish_date: '',
  content: '',
  file: null
})

const rules = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  announcement_no: [{ required: true, message: '请输入公告编号', trigger: 'blur' }],
  publish_date: [{ required: true, message: '请选择发布日期', trigger: 'change' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }]
}

// 自动提取的信息
const extractedInfo = reactive({
  inspection_unit: '',
  inspection_count: 0
})

// 监听内容变化，自动提取信息
watch(() => form.content, (newContent) => {
  if (newContent) {
    extractedInfo.inspection_unit = extractInspectionUnit(newContent)
    extractedInfo.inspection_count = extractInspectionCount(newContent)
  }
})

function extractInspectionUnit(content) {
  const match = content.match(/经(.+?)等?(单位|所|中心|院)检验/)
  return match ? match[1].trim() : ''
}

function extractInspectionCount(content) {
  const match = content.match(/(\d+)批次.*?(不符合规定|不合格|有问题)/)
  return match ? parseInt(match[1]) : 0
}

const handleFileChange = (file) => {
  form.file = file.raw
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getAnnouncements({
      ...filters.value,
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

const resetFilters = () => {
  filters.value = {
    status: 'published',
    keyword: ''
  }
  pagination.value.page = 1
  loadData()
}

const viewDetail = (id) => {
  router.push(`/announcements/${id}`)
}

const downloadAttachment = (row) => {
  if (row.attachment_path) {
    // 后端静态文件服务在 /uploads，需要通过代理访问
    window.open(`http://localhost:3000${row.attachment_path}`, '_blank')
  }
}

const handleUpload = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    uploading.value = true
    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('announcement_no', form.announcement_no)
      formData.append('publish_date', form.publish_date)
      formData.append('content', form.content)
      formData.append('status', 'published')
      // 将自动提取的关键信息也提交到后端
      if (extractedInfo.inspection_unit) {
        formData.append('inspection_unit', extractedInfo.inspection_unit)
      }
      if (extractedInfo.inspection_count > 0) {
        formData.append('inspection_count', extractedInfo.inspection_count)
      }
      if (form.file) {
        formData.append('attachment', form.file)
      }

      const res = await createAnnouncement(formData)

      const parsedCount = res?.data?.parsed_detail_count || 0
      const parseMessage = res?.data?.parse_message
      ElMessage.success(parsedCount > 0 ? `公告上传成功，已解析 ${parsedCount} 条批次明细` : '公告上传成功')
      if (parseMessage) {
        ElMessage.warning(parseMessage)
      }

      showUploadDialog.value = false
      resetForm()
      loadData()
    } catch (error) {
      console.error('上传失败:', error)
      ElMessage.error('上传失败')
    } finally {
      uploading.value = false
    }
  })
}

const resetForm = () => {
  form.title = ''
  form.announcement_no = ''
  form.publish_date = ''
  form.content = ''
  form.file = null
  extractedInfo.inspection_unit = ''
  extractedInfo.inspection_count = 0
  formRef.value?.resetFields()
}

const getStatusType = (status) => {
  const map = { published: 'success', draft: 'info', archived: 'info' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { published: '已发布', draft: '草稿', archived: '已归档' }
  return map[status] || status
}

loadData()
</script>

<style scoped>
.announcements {
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
