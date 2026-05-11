<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <div class="login-title">视频、文案管理系统</div>
      <div class="login-subtitle">请选择账号角色登录</div>
      <el-form :model="form" label-width="72px" @keyup.enter="handleLogin">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="请输入账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-button type="primary" class="login-button" :loading="loading" @click="handleLogin">登录</el-button>
        <!-- <el-button class="login-button secondary" @click="registerDialogVisible = true">注册普通用户</el-button> -->
      </el-form>
      <!-- <div class="account-tips">
        <div>开发人员：admin / admin</div>
        <div>数据管理员：data_admin / data_admin</div>
        <div>普通用户：user / user</div>
      </div>  -->
    </el-card>

    <!-- <el-dialog v-model="registerDialogVisible" title="注册普通用户" width="420px" :close-on-click-modal="false">
      <el-form :model="registerForm" label-width="84px">
        <el-form-item label="账号">
          <el-input v-model="registerForm.username" placeholder="3-30 位字母、数字或下划线" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="registerForm.display_name" placeholder="可选" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="registerForm.email" placeholder="可选" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="registerForm.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="registerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="registering" @click="handleRegister">注册</el-button>
      </template>
    </el-dialog> -->
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { login, registerNormalUser } from '@/api'
import { setAuthSession, currentUser, getRoleDefaultPath } from '@/utils/auth'

const router = useRouter()
const loading = ref(false)
const registering = ref(false)
const registerDialogVisible = ref(false)
const form = reactive({
  username: '',
  password: ''
})
const registerForm = reactive({
  username: '',
  display_name: '',
  email: '',
  password: ''
})

const handleLogin = async () => {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }

  loading.value = true
  try {
    const res = await login(form)
    const payload = res.data || {}
    setAuthSession(payload.token, payload.user)
    ElMessage.success('登录成功')

    router.replace(getRoleDefaultPath(currentUser.value?.role))
  } catch (error) {
    console.error('登录失败:', error)
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  registering.value = true
  try {
    await registerNormalUser(registerForm)
    ElMessage.success('注册成功，请使用新账号登录')
    form.username = registerForm.username
    form.password = ''
    Object.assign(registerForm, { username: '', display_name: '', email: '', password: '' })
    registerDialogVisible.value = false
  } finally {
    registering.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  border: none;
  border-radius: 14px;
}

.login-title {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.login-subtitle {
  margin: 8px 0 28px;
  text-align: center;
  color: #909399;
}

.login-button {
  width: 100%;
}

.login-button.secondary {
  margin: 10px 0 0;
}

.account-tips {
  margin-top: 18px;
  padding: 12px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
  font-size: 13px;
  line-height: 1.8;
}
</style>
