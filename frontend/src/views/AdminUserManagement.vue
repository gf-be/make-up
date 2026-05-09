<template>
  <div class="admin-users-page">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="card-title">用户管理</span>
          <div class="actions">
            <el-button type="primary" @click="openCreate">新建用户</el-button>
            <el-button :loading="loading" @click="loadUsers">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="users" v-loading="loading" stripe empty-text="暂无用户数据">
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="display_name" label="昵称" min-width="120" />
        <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip />
        <el-table-column prop="role_label" label="角色" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="上次登录" width="170">
          <template #default="{ row }">{{ row.last_login_at || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :disabled="row.id === currentUser?.id" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isCreate ? '新建用户' : '编辑用户'" width="460px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <el-form-item label="账号" required>
          <el-input v-model="form.username" placeholder="3-30 位字母数字下划线" />
        </el-form-item>
        <el-form-item v-if="isCreate" label="初始密码" required>
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.display_name" placeholder="可选" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="可选" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option
              v-for="opt in roleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="正常" value="active" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isCreate" label="重置密码">
          <el-input v-model="form.new_password" type="password" show-password placeholder="留空则不修改" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser } from '@/api'
import { currentUser } from '@/utils/auth'

const loading = ref(false)
const saving = ref(false)
const users = ref([])
const dialogVisible = ref(false)
const isCreate = ref(true)
const editingId = ref(null)

const roleOptions = [
  { label: '系统管理员', value: 'system_admin' },
  { label: '开发管理员', value: 'developer' },
  { label: '数据管理员', value: 'data_admin' },
  { label: '普通用户', value: 'normal_user' }
]

const form = reactive({
  username: '',
  password: '',
  display_name: '',
  email: '',
  role: 'normal_user',
  status: 'active',
  new_password: ''
})

const resetForm = () => {
  Object.assign(form, {
    username: '',
    password: '',
    display_name: '',
    email: '',
    role: 'normal_user',
    status: 'active',
    new_password: ''
  })
}

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await listAdminUsers()
    users.value = res.data || []
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

const openCreate = () => {
  isCreate.value = true
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row = {}) => {
  isCreate.value = false
  editingId.value = row.id
  resetForm()
  form.username = row.username || ''
  form.display_name = row.display_name || ''
  form.email = row.email || ''
  form.role = row.role || 'normal_user'
  form.status = row.status || 'active'
  dialogVisible.value = true
}

const submitForm = async () => {
  saving.value = true
  try {
    if (isCreate.value) {
      if (!form.username.trim() || !form.password) {
        ElMessage.warning('请填写账号和初始密码')
        return
      }
      await createAdminUser({
        username: form.username.trim(),
        password: form.password,
        display_name: form.display_name,
        email: form.email || undefined,
        role: form.role
      })
      ElMessage.success('用户已创建')
    } else {
      const usernameTrim = String(form.username || '').trim()
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(usernameTrim)) {
        ElMessage.warning('账号需为 3-30 位字母、数字或下划线')
        return
      }
      const payload = {
        username: usernameTrim,
        display_name: form.display_name,
        email: form.email || '',
        role: form.role,
        status: form.status
      }

      if (form.new_password) {
        payload.new_password = form.new_password
      }
      await updateAdminUser(editingId.value, payload)
      ElMessage.success('用户已更新')
    }
    dialogVisible.value = false
    await loadUsers()
  } finally {
    saving.value = false
  }
}


const handleDelete = async (row = {}) => {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.username}」吗？此操作不可恢复。`, '删除用户', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await deleteAdminUser(row.id)
    ElMessage.success('用户已删除')
    await loadUsers()
  } catch (e) {
    if (e !== 'cancel') {
      //
    }
  }
}


</script>

<style scoped>
.admin-users-page {
  max-width: 1400px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  gap: 8px;
}

.card-title {
  font-weight: 600;
}
</style>
