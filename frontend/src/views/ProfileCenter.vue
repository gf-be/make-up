<template>
  <div class="profile-page">
    <el-row :gutter="20">
      <el-col :xs="24" :md="14">
        <el-card shadow="never">
          <template #header>
            <span class="card-title">个人资料</span>
          </template>
          <el-form :model="profileForm" label-width="88px" class="profile-form">
            <el-form-item label="账号" required>
              <el-input v-model="profileForm.username" placeholder="登录账号，3-30 位字母、数字或下划线" maxlength="30" />
            </el-form-item>
           
            <el-form-item label="昵称">
              <el-input v-model="profileForm.display_name" placeholder="展示名称" maxlength="100" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="profileForm.email" placeholder="可选" maxlength="100" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingProfile" @click="handleSaveProfile">保存资料</el-button>
              <el-button type="primary" plain @click="passwordDialogVisible = true">更改登录密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
  
    </el-row>

    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px" :close-on-click-modal="false">
      <el-form :model="passwordForm" label-width="96px">
        <el-form-item label="当前密码">
          <el-input v-model="passwordForm.current_password" type="password" show-password autocomplete="off" />
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
import { onMounted, reactive, ref, watch } from 'vue'
import { updateCurrentUserPassword, updateCurrentUserProfile } from '@/api'
import { currentUser, getAuthToken, getRoleLabel, setAuthSession } from '@/utils/auth'

const savingProfile = ref(false)
const savingPassword = ref(false)
const passwordDialogVisible = ref(false)

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/

const profileForm = reactive({
  username: '',
  display_name: '',
  email: ''
})

const passwordForm = reactive({
  current_password: '',
  new_password: '',
  confirm_password: ''
})

function syncProfileForm() {
  profileForm.username = currentUser.value?.username || ''
  profileForm.display_name = currentUser.value?.display_name || ''
  profileForm.email = currentUser.value?.email || ''
}

onMounted(syncProfileForm)

watch(
  () => currentUser.value?.id,
  () => syncProfileForm()
)

const handleSaveProfile = async () => {
  const username = String(profileForm.username || '').trim()
  if (!USERNAME_PATTERN.test(username)) {
    ElMessage.warning('账号需为 3-30 位字母、数字或下划线')
    return
  }
  savingProfile.value = true
  try {
    const res = await updateCurrentUserProfile({
      username,
      display_name: profileForm.display_name,
      email: profileForm.email
    })
    const next = res.data
    if (next) {
      setAuthSession(getAuthToken(), next)
    }
    ElMessage.success(res.message || '资料已更新')
  } finally {
    savingProfile.value = false
  }
}

const handleUpdatePassword = async () => {
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
    passwordDialogVisible.value = false
    Object.assign(passwordForm, { current_password: '', new_password: '', confirm_password: '' })
  } finally {
    savingPassword.value = false
  }
}
</script>

<style scoped>
.profile-page {
  max-width: 960px;
}

.card-title {
  font-weight: 600;
}

.profile-form {
  max-width: 520px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
