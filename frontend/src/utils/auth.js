import { ref } from 'vue'

export const ROLE_LABELS = {
  system_admin: '系统管理员',
  developer: '开发管理员',
  data_admin: '数据管理员',
  normal_user: '普通用户'
}

export const MODULE_PERMISSIONS = {
  system_admin: ['profile', 'admin-users'],
  developer: ['home', 'unqualified-products', 'products-manage', 'pivot-analysis', 'sampling-search', 'announcement-staging', 'announcements', 'inspections', 'companies', 'companies-manage', 'unqualified-companies', 'supervisions'],
  // data_admin: ['home', 'announcement-staging', 'announcements', 'companies', 'unqualified-companies'],
  data_admin: ['announcement-staging', 'announcements', 'companies-manage', 'products-manage'],
  normal_user: ['home', 'unqualified-products', 'inspections', 'companies','supervisions']
}

const AUTH_STORAGE_KEY = 'cosmetics_current_user'
const TOKEN_STORAGE_KEY = 'cosmetics_auth_token'

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')
  } catch (error) {
    return null
  }
}

export const currentUser = ref(readStoredUser())

export function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function setAuthSession(token, user) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token || '')
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user || null))
  currentUser.value = user || null
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(AUTH_STORAGE_KEY)
  currentUser.value = null
}

export function hasModuleAccess(moduleKey, user = currentUser.value) {
  if (!moduleKey) return true
  const modules = MODULE_PERMISSIONS[user?.role] || []
  return modules.includes(moduleKey)
}

/** 路由 meta.module → 前端 path（用于登录后首页、无权访问时的安全回退） */
const MODULE_ROUTE_PATHS = {
  profile: '/profile',
  'admin-users': '/admin/users',
  home: '/home',
  'unqualified-products': '/unqualified-products',
  'pivot-analysis': '/pivot-analysis',
  'sampling-search': '/sampling-search',
  'announcement-staging': '/announcement-staging',
  announcements: '/announcements',
  inspections: '/inspections',
  companies: '/companies',
  'companies-manage': '/companies-manage',
  'products-manage': '/products-manage',
  'unqualified-companies': '/companies/unqualified',
  supervisions: '/supervisions'
}

/**
 * 登录成功或访问无权限页时，跳转到该角色第一个有权限的菜单路径，避免回退到 /home 造成死循环（如 data_admin）。
 */
export function getRoleDefaultPath(role) {
  const modules = MODULE_PERMISSIONS[role] || []
  const order = [
    'profile',
    'admin-users',
    'home',
    'announcement-staging',
    'announcements',
    'companies-manage',
    'products-manage',
    'companies',
    'unqualified-products',
    'inspections',
    'supervisions',
    'unqualified-companies',
    'sampling-search',
    'pivot-analysis'
  ]
  for (const key of order) {
    if (modules.includes(key)) {
      const path = MODULE_ROUTE_PATHS[key]
      if (path) return path
    }
  }
  return '/login'
}

export function canManageAnnouncementProducts(user = currentUser.value) {
  return ['developer', 'data_admin'].includes(user?.role)
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || '未登录'
}
