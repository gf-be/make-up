<template>
  <el-config-provider :locale="zhCn">
  <router-view v-if="route.path === '/login'" />
  <el-container v-else class="layout-container">
    <el-header class="header" height="auto">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="28">
            <component :is="MENU_ICONS.Document" />
          </el-icon>
          <span class="logo-title">视频、文案管理系统</span>
        </div>
        <div class="nav-scroll">
          <el-menu :default-active="activeMenu" mode="horizontal" router class="nav-menu">
            <el-menu-item v-for="item in visibleMenus" :key="item.index" :index="item.index">
              <el-icon>
                <component :is="MENU_ICONS[item.icon] || MENU_ICONS.Document" />
              </el-icon>
              <span>{{ item.label }}</span>
            </el-menu-item>
          </el-menu>
        </div>
        <div class="user-box">
          <el-popover
            v-model:visible="profilePopoverVisible"
            placement="bottom-end"
            :width="356"
            trigger="manual"
            popper-class="header-user-profile-popover"
          >
            <template #reference>
              <span
                class="profile-tag-trigger"
                @mouseenter="onProfilePopoverTriggerEnter"
                @mouseleave="onProfilePopoverTriggerLeave"
              >
                <el-tag effect="dark">{{ currentUser?.role_label || '未登录' }}</el-tag>
              </span>
            </template>
            <div
              v-if="isLoggedIn"
              class="header-profile-panel"
              @mouseenter="cancelProfilePopoverHideTimer"
              @mouseleave="scheduleProfilePopoverHide"
            >
              <div class="header-profile-panel-title">当前登录信息</div>
              <el-descriptions :column="1" border size="small" class="header-profile-desc">
                <el-descriptions-item label="账号">{{ currentUser?.username || '-' }}</el-descriptions-item>
                <el-descriptions-item label="昵称">{{ currentUser?.display_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="邮箱">{{ currentUser?.email || '-' }}</el-descriptions-item>
             </el-descriptions>
              <div class="header-profile-actions">
                <el-button type="primary" size="small" @click="openProfileDialog">修改资料</el-button>
                <el-button type="primary" plain size="small" @click="openPasswordDialog">修改密码</el-button>
              </div>
            </div>
            <div
              v-else
              class="header-profile-panel header-profile-panel--guest"
              @mouseenter="cancelProfilePopoverHideTimer"
              @mouseleave="scheduleProfilePopoverHide"
            >
              <p class="header-profile-guest-tip">请先登录后查看个人信息</p>
            </div>
          </el-popover>
          <span class="username">{{ currentUser?.username }}</span>
          <el-button size="small" plain @click="handleLogout">退出</el-button>
        </div>
      </div>
    </el-header>

    <el-main class="main-content">
      <router-view v-slot="{ Component, route: viewRoute }">
        <keep-alive :include="KEEP_ALIVE_ROUTE_NAMES">
          <component
            :is="Component"
            v-if="Component"
            :key="viewRoute.meta.keepAlive ? viewRoute.name : viewRoute.fullPath"
          />
        </keep-alive>
      </router-view>
    </el-main>
  </el-container>

  <el-dialog v-model="profileDialogVisible" title="修改资料" width="440px" :close-on-click-modal="false">
    <el-form :model="profileForm" label-width="88px" @keydown.enter="onProfileFormEnterKey">
      <el-form-item label="账号">
        <el-input v-model="profileForm.username" maxlength="30" placeholder="3-30 位字母数字下划线" />
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="profileForm.display_name" maxlength="10" placeholder="展示名称" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="profileForm.email" maxlength="20" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="profileDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingProfile" @click="handleSaveProfile">保存资料</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="passwordDialogVisible" title="修改当前账号密码" width="420px" :close-on-click-modal="false">
    <el-form :model="passwordForm" label-width="84px" @keydown.enter="onPasswordFormEnterKey">
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
  </el-config-provider>
</template>

<script setup>

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { logout, updateCurrentUserPassword, updateCurrentUserProfile } from '@/api'
import { MENU_ICONS } from '@/constants/menu-icons'
import {
  // MODULE_PERMISSIONS,
  clearAuthSession,
  currentUser,
  getAuthToken,
  // getRoleLabel,
  hasModuleAccess,
  setAuthSession
} from '@/utils/auth'

const route = useRoute()
const router = useRouter()

/** 与路由 meta.keepAlive 及页面 defineOptions({ name }) 一致 */
const KEEP_ALIVE_ROUTE_NAMES = ['UnqualifiedProducts']

const menus = [
  { index: '/profile', key: 'profile', label: '个人中心', icon: 'User' },
  { index: '/admin/users', key: 'admin-users', label: '用户管理', icon: 'Setting' },
  // { index: '/home', key: 'home', label: '首页', icon: 'House' },
  { index: '/unqualified-products', key: 'unqualified-products', label: '产品文案', icon: 'Document' },
  { index: '/announcement-staging', key: 'announcement-staging', label: '数据导入', icon: 'DataAnalysis' },
  { index: '/announcements', key: 'announcements', label: '数据管理', icon: 'Bell' },
  { index: '/announcements-manage', key: 'announcements-manage', label: '通告管理', icon: 'Bell' },
  // { index: '/inspections', key: 'inspections', label: '抽样检查', icon: 'Checked' },
  { index: '/companies', key: 'companies', label: '企业', icon: 'OfficeBuilding' },
  { index: '/companies-manage', key: 'companies-manage', label: '企业管理', icon: 'OfficeBuilding' },
  { index: '/category-manage', key: 'category-manage', label: '分类管理', icon: 'CollectionTag' },
  { index: '/products-manage', key: 'products-manage', label: '产品管理', icon: 'Goods' },
  { index: '/companies/unqualified', key: 'unqualified-companies', label: '不合格企业', icon: 'TrendCharts' },
  // { index: '/supervisions', key: 'supervisions', label: '飞行检查', icon: 'Warning' }
]

const visibleMenus = computed(() =>
  menus.filter((item) => {
    if (!hasModuleAccess(item.key)) return false
    if (item.key === 'companies' && currentUser.value?.role === 'normal_user') return false
    return true
  })
)

// const MODULE_LABELS = {
//   profile: '个人中心',
//   'admin-users': '用户管理',
//   // home: '首页',
//   'unqualified-products': '不合格产品',
//   'announcement-staging': '导入检查',
//   announcements: '抽检通告',
//   'announcements-manage': '通告管理',
//   inspections: '抽样检查',
//   companies: '企业管理',
//   'companies-manage': '企业管理',
//   'category-manage': '分类管理',
//   'products-manage': '产品管理',
//   'unqualified-companies': '不合格企业',
//   supervisions: '飞行检查',
//   'pivot-analysis': '数据透视',
//   'sampling-search': '抽样检索'
// }

// const visibleModuleLabels = computed(() =>
//   (MODULE_PERMISSIONS[currentUser.value?.role] || []).map((key) => MODULE_LABELS[key] || key)
// )

const isLoggedIn = computed(() => Boolean(currentUser.value?.username))

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/

const profilePopoverVisible = ref(false)
/** 鼠标离开角色标签或浮层后延迟关闭（毫秒） */
const PROFILE_POPOVER_HIDE_DELAY_MS = 2000
let profilePopoverHideTimer = null

const profileForm = reactive({
  username: '',
  display_name: '',
  email: ''
})

const savingProfile = ref(false)
const profileDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const savingPassword = ref(false)
const passwordForm = reactive({
  current_password: '',
  new_password: '',
  confirm_password: ''
})

function syncProfileFormFromUser() {
  profileForm.username = currentUser.value?.username || ''
  profileForm.display_name = currentUser.value?.display_name || ''
  profileForm.email = currentUser.value?.email || ''
}

watch(
  () => currentUser.value?.id,
  () => syncProfileFormFromUser()
)

function cancelProfilePopoverHideTimer() {
  if (profilePopoverHideTimer != null) {
    window.clearTimeout(profilePopoverHideTimer)
    profilePopoverHideTimer = null
  }
}

function scheduleProfilePopoverHide() {
  cancelProfilePopoverHideTimer()
  profilePopoverHideTimer = window.setTimeout(() => {
    profilePopoverVisible.value = false
    profilePopoverHideTimer = null
  }, PROFILE_POPOVER_HIDE_DELAY_MS)
}

function onProfilePopoverTriggerEnter() {
  cancelProfilePopoverHideTimer()
  profilePopoverVisible.value = true
  if (isLoggedIn.value) {
    syncProfileFormFromUser()
  }
}

function onProfilePopoverTriggerLeave() {
  scheduleProfilePopoverHide()
}

function onProfileFormEnterKey(event) {
  if (!profileDialogVisible.value || savingProfile.value) return
  if (event.isComposing) return
  const tag = String(event.target?.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA') return
  event.preventDefault()
  handleSaveProfile()
}

function onPasswordFormEnterKey(event) {
  if (!passwordDialogVisible.value || savingPassword.value) return
  if (event.isComposing) return
  const tag = String(event.target?.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA') return
  event.preventDefault()
  handleUpdatePassword()
}

async function handleSaveProfile() {
  if (!isLoggedIn.value) return
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
    profileDialogVisible.value = false
  } finally {
    savingProfile.value = false
  }
}

function openProfileDialog() {
  cancelProfilePopoverHideTimer()
  syncProfileFormFromUser()
  profileDialogVisible.value = true
}

function openPasswordDialog() {
  cancelProfilePopoverHideTimer()
  passwordDialogVisible.value = true
}

async function handleUpdatePassword() {
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

onBeforeUnmount(() => {
  cancelProfilePopoverHideTimer()
})

const activeMenu = computed(() => {
  if (route.path.startsWith('/profile')) return '/profile'
  if (route.path.startsWith('/admin/users')) return '/admin/users'

  if (route.path.startsWith('/home')) return '/home'
  if (route.path.startsWith('/announcements-manage')) return '/announcements-manage'
  if (route.path.startsWith('/announcements')) return '/announcements'
  if (route.path.startsWith('/announcement-staging')) return '/announcement-staging'

  if (route.path.startsWith('/inspections')) return '/inspections'
  if (route.path.startsWith('/companies/unqualified')) return '/companies/unqualified'

  if (route.path.startsWith('/unqualified-products')) return '/unqualified-products'

  if (route.path.startsWith('/companies')) {
    if (currentUser.value?.role === 'normal_user') return '/unqualified-products'
    return '/companies'
  }
  if (route.path.startsWith('/products-manage')) return '/products-manage'
  if (route.path.startsWith('/companies-manage')) return '/companies-manage'
  if (route.path.startsWith('/category-manage')) return '/category-manage'
  if (route.path.startsWith('/supervisions')) return '/supervisions'

  return route.path
})

const handleLogout = async () => {
  try {
    await logout()
  } catch (error) {
    // 本地会话仍需清理，避免后端会话过期时无法退出。
  }
  clearAuthSession()
  router.replace('/login')
}

</script>

<style scoped>
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.el-menu--horizontal>.el-menu-item.is-active {
  color: #f5f7f8 !important;
}
:deep(.el-descriptions__label.el-descriptions__cell.is-bordered-label) {
  /* width: 100%!important; */
  background: #F2F7FF !important;
  /* background: #E8F3FF!important; */
}
.header {
  /* background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); */
  background:rgb(61, 129, 218);
  color: white;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 60px;
  padding: 8px 16px;
  box-sizing: border-box;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: bold;
  flex-shrink: 0;
}

.logo-title {
  white-space: nowrap;
}

@media (max-width: 640px) {
  .logo {
    font-size: 16px;
  }
  .logo :deep(.el-icon) {
    font-size: 22px !important;
  }
}

.nav-scroll {
  flex: 1 1 200px;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.nav-scroll::-webkit-scrollbar {
  height: 4px;
}

.nav-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 2px;
}

.nav-menu {
  background: transparent;
  border: none;
  width: max-content;
  min-width: 100%;
  justify-content: flex-end;
}

.user-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .user-box .username {
    display: none;
  }
}

.username {
  font-size: 13px;
}

.profile-tag-trigger {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  cursor: default;
}

.header-profile-panel-title {
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.header-profile-desc {
  margin-bottom: 4px;
}

.header-profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.header-profile-panel--guest {
  padding: 8px 0;
}

.header-profile-guest-tip {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.nav-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 2px solid transparent;
  margin: 0 5px;
}

.nav-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.2);
  border-bottom-color: white;
  color: white;
}

.main-content {
  background: #f5f7fa;
  padding: 16px;
  overflow-y: auto;
  box-sizing: border-box;
}

@media (min-width: 768px) {
  .main-content {
    padding: 20px;
  }
}
</style>

<style>
.header-user-profile-popover.el-popover.el-popper {
  padding: 12px 14px 14px;
}
</style>
