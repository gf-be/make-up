<template>
  <div class="home-page">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="8" :lg="8">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>当前登录信息</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="账号">{{ currentUser?.username || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ currentUser?.display_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="角色">
              <el-tag>{{ currentUser?.role_label || getRoleLabel(currentUser?.role) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="可用模块">{{ visibleModuleLabels.join('、') || '-' }}</el-descriptions-item>
          </el-descriptions>
          <el-button type="primary" plain class="password-button" @click="passwordDialogVisible = true">修改密码</el-button>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="24" :md="16" :lg="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>文案生产日志</span>
              <el-button link type="primary" :loading="loading" @click="loadLogs">刷新</el-button>
            </div>
          </template>
          <el-table :data="logs" stripe v-loading="loading" empty-text="暂无文案生产日志">
            <el-table-column prop="created_at" label="时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column prop="username" label="用户" width="110" />
            <el-table-column prop="dimension_label" label="维度线" min-width="220" show-overflow-tooltip />
            <el-table-column prop="range_label" label="生成范围" min-width="220" show-overflow-tooltip />
            <el-table-column prop="detail_count" label="明细数" width="90" align="center" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="passwordDialogVisible" title="修改当前账号密码" width="420px" :close-on-click-modal="false">
      <el-form :model="passwordForm" label-width="84px">
        <el-form-item label="当前密码">
          <el-input v-model="passwordForm.current_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.new_password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="passwordForm.confirm_password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPassword" @click="handleUpdatePassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { getOperationLogs, updateCurrentUserPassword } from '@/api'
import { MODULE_PERMISSIONS, currentUser, getRoleLabel } from '@/utils/auth'

const loading = ref(false)
const savingPassword = ref(false)
const passwordDialogVisible = ref(false)
const logs = ref([])
const passwordForm = reactive({
  current_password: '',
  new_password: '',
  confirm_password: ''
})

const MODULE_LABELS = {
  home: '首页',
  'unqualified-products': '不合格产品',
  'pivot-analysis': '数据矩阵',
  'sampling-search': '数据检索',
  'announcement-staging': '导入检查',
  'announcement-tracebacks': '倒溯处理',
  announcements: '抽检通告',
  inspections: '抽样检查',
  companies: '企业管理',
  'unqualified-companies': '不合格企业',
  supervisions: '飞行检查'
}

const visibleModuleLabels = computed(() => {
  return (MODULE_PERMISSIONS[currentUser.value?.role] || []).map((key) => MODULE_LABELS[key] || key)
})

const formatDateTime = (value) => {
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : value || '-'
}

const loadLogs = async () => {
  loading.value = true
  try {
    const res = await getOperationLogs({ limit: 50 })
    logs.value = res.data || []
  } finally {
    loading.value = false
  }
}

const handleUpdatePassword = async () => {
  if (!passwordForm.current_password || !passwordForm.new_password) {
    ElMessage.warning('请输入当前密码和新密码')
    return
  }
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }

  savingPassword.value = true
  try {
    await updateCurrentUserPassword({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password
    })
    ElMessage.success('密码已更新')
    Object.assign(passwordForm, { current_password: '', new_password: '', confirm_password: '' })
    passwordDialogVisible.value = false
  } finally {
    savingPassword.value = false
  }
}

onMounted(loadLogs)
</script>

<style scoped>
.home-page {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.password-button {
  margin-top: 16px;
  width: 100%;
}
</style>
