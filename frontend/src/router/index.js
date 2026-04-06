import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/announcements',
    name: 'Announcements',
    component: () => import('../views/Announcements.vue')
  },
  {
    path: '/announcements/:id',
    name: 'AnnouncementDetail',
    component: () => import('../views/AnnouncementDetail.vue')
  },
  {
    path: '/inspections',
    name: 'Inspections',
    component: () => import('../views/Inspections.vue')
  },
  {
    path: '/inspections/:id',
    name: 'InspectionDetail',
    component: () => import('../views/InspectionDetail.vue')
  },
  {
    path: '/companies',
    name: 'Companies',
    component: () => import('../views/Companies.vue')
  },
  {
    path: '/unqualified-products',
    name: 'UnqualifiedProducts',
    component: () => import('../views/UnqualifiedProducts.vue')
  },
  {
    path: '/companies/stats',
    redirect: '/companies/unqualified'
  },


  {
    path: '/companies/:id',
    name: 'CompanyDetail',
    component: () => import('../views/CompanyDetail.vue')
  },
  {
    path: '/companies/unqualified',
    name: 'UnqualifiedCompanies',
    component: () => import('../views/UnqualifiedCompanies.vue')
  },
  {
    path: '/supervisions',
    name: 'Supervisions',
    component: () => import('../views/Supervisions.vue')
  },
  {
    path: '/supervisions/:id',
    name: 'SupervisionDetail',
    component: () => import('../views/SupervisionDetail.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
