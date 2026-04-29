import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, hasModuleAccess } from '@/utils/auth'

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { module: 'home' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { module: 'home' }
  },
  {
    path: '/pivot-analysis',
    name: 'PivotAnalysis',
    component: () => import('../views/PivotAnalysis.vue'),
    meta: { module: 'pivot-analysis' }
  },
  {
    path: '/sampling-search',
    name: 'SamplingDataSearch',
    component: () => import('../views/SamplingDataSearch.vue'),
    meta: { module: 'sampling-search' }
  },

  {
    path: '/announcements',
    name: 'Announcements',
    component: () => import('../views/Announcements.vue'),
    meta: { module: 'announcements' }
  },
  {
    path: '/announcement-staging',
    name: 'AnnouncementStaging',
    component: () => import('../views/AnnouncementStaging.vue'),
    meta: { module: 'announcement-staging' }
  },
  {
    path: '/announcement-tracebacks',
    name: 'AnnouncementTracebacks',
    component: () => import('../views/AnnouncementTracebacks.vue'),
    meta: { module: 'announcement-tracebacks' }
  },
  {
    path: '/announcements/:id',

    name: 'AnnouncementDetail',
    component: () => import('../views/AnnouncementDetail.vue'),
    meta: { module: 'announcements' }
  },

  {
    path: '/inspections',
    name: 'Inspections',
    component: () => import('../views/Inspections.vue'),
    meta: { module: 'inspections' }
  },
  {
    path: '/inspections/:id',
    name: 'InspectionDetail',
    component: () => import('../views/InspectionDetail.vue'),
    meta: { module: 'inspections' }
  },
  {
    path: '/companies',
    name: 'Companies',
    component: () => import('../views/Companies.vue'),
    meta: { module: 'companies' }
  },
  {
    path: '/unqualified-products',
    name: 'UnqualifiedProducts',
    component: () => import('../views/UnqualifiedProducts.vue'),
    meta: { module: 'unqualified-products' }
  },
  {
    path: '/unqualified-products/:id',
    name: 'UnqualifiedProductDetail',
    component: () => import('../views/UnqualifiedProductDetail.vue'),
    meta: { module: 'unqualified-products' }
  },

  {
    path: '/companies/stats',
    redirect: '/companies/unqualified'
  },


  {
    path: '/companies/:id',
    name: 'CompanyDetail',
    component: () => import('../views/CompanyDetail.vue'),
    meta: { module: 'companies' }
  },
  {
    path: '/companies/unqualified',
    name: 'UnqualifiedCompanies',
    component: () => import('../views/UnqualifiedCompanies.vue'),
    meta: { module: 'unqualified-companies' }
  },
  {
    path: '/supervisions',
    name: 'Supervisions',
    component: () => import('../views/Supervisions.vue'),
    meta: { module: 'supervisions' }
  },
  {
    path: '/supervisions/:id',
    name: 'SupervisionDetail',
    component: () => import('../views/SupervisionDetail.vue'),
    meta: { module: 'supervisions' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (!currentUser.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (!hasModuleAccess(to.meta.module)) {
    return '/home'
  }
  return true
})

export default router
