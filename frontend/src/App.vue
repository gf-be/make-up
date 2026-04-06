<template>
  <el-container class="layout-container">
    <el-header class="header">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="28"><Document /></el-icon>
          <span>化妆品资讯系统</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          router
          class="nav-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据概览</span>
          </el-menu-item>
          <el-menu-item index="/announcements">
            <el-icon><Bell /></el-icon>
            <span>抽检通告</span>
          </el-menu-item>

          <el-menu-item index="/inspections">
            <el-icon><Checked /></el-icon>
            <span>抽样检查</span>
          </el-menu-item>
          <el-menu-item index="/companies">
            <el-icon><OfficeBuilding /></el-icon>
            <span>企业管理</span>
          </el-menu-item>
          <el-menu-item index="/companies/unqualified">
            <el-icon><TrendCharts /></el-icon>
            <span>不合格企业</span>
          </el-menu-item>
          <el-menu-item index="/unqualified-products">
            <el-icon><Document /></el-icon>
            <span>不合格产品</span>
          </el-menu-item>
          <el-menu-item index="/supervisions">
            <el-icon><Warning /></el-icon>
            <span>飞行检查</span>
          </el-menu-item>


        </el-menu>
      </div>
    </el-header>
    
    <el-main class="main-content">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => {
  if (route.path.startsWith('/announcements')) return '/announcements'
  if (route.path.startsWith('/inspections')) return '/inspections'
  if (route.path.startsWith('/companies/unqualified')) return '/companies/unqualified'
  if (route.path.startsWith('/unqualified-products')) return '/unqualified-products'
  if (route.path.startsWith('/companies')) return '/companies'
  if (route.path.startsWith('/supervisions')) return '/supervisions'

  return route.path
})

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
  height: 100%;
  padding: 0 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: bold;
}

.nav-menu {
  background: transparent;
  border: none;
  flex: 1;
  justify-content: flex-end;
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
  padding: 20px;
  overflow-y: auto;
}
</style>
