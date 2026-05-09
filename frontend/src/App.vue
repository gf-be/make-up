<template>
  <router-view v-if="route.path === '/login'" />
  <el-container v-else class="layout-container">
    <el-header class="header" height="auto">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="28">
            <Document />
          </el-icon>
          <span class="logo-title">视频、文案管理系统</span>
        </div>
        <div class="nav-scroll">
          <el-menu :default-active="activeMenu" mode="horizontal" router class="nav-menu">
            <el-menu-item v-for="item in visibleMenus" :key="item.index" :index="item.index">
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <span>{{ item.label }}</span>
            </el-menu-item>
          </el-menu>
        </div>
        <div class="user-box">
          <el-tag effect="dark">{{ currentUser?.role_label || '未登录' }}</el-tag>
          <span class="username">{{ currentUser?.username }}</span>
          <el-button size="small" plain @click="handleLogout">退出</el-button>
        </div>
      </div>
    </el-header>

    <el-main class="main-content">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout } from '@/api'
import { clearAuthSession, currentUser, hasModuleAccess } from '@/utils/auth'

const route = useRoute()
const router = useRouter()

const menus = [
  { index: '/profile', key: 'profile', label: '个人中心', icon: 'User' },
  { index: '/admin/users', key: 'admin-users', label: '用户管理', icon: 'Setting' },
  { index: '/home', key: 'home', label: '首页', icon: 'House' },
  { index: '/unqualified-products', key: 'unqualified-products', label: '产品', icon: 'Document' },
  { index: '/announcement-staging', key: 'announcement-staging', label: '数据导入', icon: 'DataAnalysis' },
  { index: '/announcements', key: 'announcements', label: '已导入通告', icon: 'Bell' },
  { index: '/inspections', key: 'inspections', label: '抽样检查', icon: 'Checked' },
  { index: '/companies', key: 'companies', label: '企业', icon: 'OfficeBuilding' },
  { index: '/companies-manage', key: 'companies-manage', label: '企业管理', icon: 'OfficeBuilding' },
  { index: '/products-manage', key: 'products-manage', label: '产品管理', icon: 'Goods' },
  { index: '/companies/unqualified', key: 'unqualified-companies', label: '不合格企业', icon: 'TrendCharts' },
  { index: '/supervisions', key: 'supervisions', label: '飞行检查', icon: 'Warning' }
]

const visibleMenus = computed(() => menus.filter((item) => hasModuleAccess(item.key)))

const activeMenu = computed(() => {
  if (route.path.startsWith('/profile')) return '/profile'
  if (route.path.startsWith('/admin/users')) return '/admin/users'

  if (route.path.startsWith('/home')) return '/home'
  if (route.path.startsWith('/announcements')) return '/announcements'
  if (route.path.startsWith('/announcement-staging')) return '/announcement-staging'

  if (route.path.startsWith('/inspections')) return '/inspections'
  if (route.path.startsWith('/companies/unqualified')) return '/companies/unqualified'

  if (route.path.startsWith('/unqualified-products')) return '/unqualified-products'

  if (route.path.startsWith('/companies')) return '/companies'
  if (route.path.startsWith('/products-manage')) return '/products-manage'
  if (route.path.startsWith('/companies-manage')) return '/companies-manage'
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

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
