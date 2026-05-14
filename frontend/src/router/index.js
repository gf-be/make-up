import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, getRoleDefaultPath, hasModuleAccess } from '@/utils/auth'

const routes = [
  {
    path: '/',
    redirect: () => {
      if (!currentUser.value) return '/login'
      return getRoleDefaultPath(currentUser.value.role)
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/profile',
    name: 'ProfileCenter',
    component: () => import('../views/ProfileCenter.vue'),
    meta: { module: 'profile' }
  },
  {
    path: '/admin/users',
    name: 'AdminUserManagement',
    component: () => import('../views/AdminUserManagement.vue'),
    meta: { module: 'admin-users' }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { module: 'home' }
  },

  {
    path: '/announcements',
    name: 'Announcements',
    component: () => import('../views/Announcements.vue'),
    meta: { module: 'announcements' }
  },
  {
    path: '/announcements-manage',
    name: 'AnnouncementsManage',
    component: () => import('../views/AnnouncementsManage.vue'),
    meta: { module: 'announcements-manage' }
  },
  {
    path: '/announcement-staging',
    name: 'AnnouncementStaging',
    component: () => import('../views/AnnouncementStaging.vue'),
    meta: { module: 'announcement-staging' }
  },
  {
    path: '/announcement-tracebacks',
    redirect: (to) => {
      const query = { ...to.query };
      delete query.path;
      const legacyId = query.id;
      delete query.id;
      query.view = 'traceback';
      if (legacyId && !query.tracebackId) {
        query.tracebackId = String(Array.isArray(legacyId) ? legacyId[0] : legacyId);
      }
      return {
        path: '/announcement-staging',
        query
      };
    }
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
    path: '/companies-manage',
    name: 'CompaniesManage',
    component: () => import('../views/CompaniesManage.vue'),
    meta: { module: 'companies-manage' }
  },
  {
    path: '/category-manage',
    name: 'CategoryManage',
    component: () => import('../views/CategoryManage.vue'),
    meta: { module: 'category-manage' }
  },
  {
    path: '/products-manage',
    name: 'ProductsManage',
    component: () => import('../views/ProductsManage.vue'),
    meta: { module: 'products-manage' }
  },
  {
    path: '/unqualified-products',
    name: 'UnqualifiedProducts',
    component: () => import('../views/UnqualifiedProducts.vue'),
    meta: { module: 'unqualified-products' }
  },
  {
    path: '/unqualified-products/:id/usage',
    name: 'UnqualifiedProductUsageRecords',
    component: () => import('../views/UnqualifiedProductUsageRecords.vue'),
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
    // 不携带 redirect：避免共用设备/换账号登录后仍跳回他人书签或地址栏中的深链
    return { path: '/login' }
  }
  const mod = to.meta.module
  if (mod && !hasModuleAccess(mod)) {
    return getRoleDefaultPath(currentUser.value.role)
  }
  return true
})

export default router
