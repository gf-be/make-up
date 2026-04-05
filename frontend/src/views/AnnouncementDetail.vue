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
                <el-button type="primary" size="small" link @click="viewDetail(row.id)">
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
import { getAnnouncementById, getRelatedInspections } from '@/api/index'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const announcement = ref(null)
const relatedInspections = ref([])

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
    const res = await getAnnouncementById(id)
    announcement.value = res.data
    // 加载相关检查记录
    await fetchRelatedInspections(id)
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

.related-inspections {
  margin-top: 30px;
}
</style>
