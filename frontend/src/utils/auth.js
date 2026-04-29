import { ref } from 'vue'

export const ROLE_LABELS = {
  developer: '开发人员',
  data_admin: '数据管理员',
  normal_user: '普通用户'
}

export const MODULE_PERMISSIONS = {
  developer: ['home', 'unqualified-products', 'pivot-analysis', 'announcement-staging', 'announcement-tracebacks', 'announcements', 'inspections', 'companies', 'unqualified-companies', 'supervisions'],
  data_admin: ['home', 'announcement-staging', 'announcement-tracebacks', 'announcements', 'companies', 'unqualified-companies'],
  normal_user: ['home', 'unqualified-products', 'pivot-analysis', 'sampling-search', 'inspections', 'companies']
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

export function canManageAnnouncementProducts(user = currentUser.value) {
  return ['developer', 'data_admin'].includes(user?.role)
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || '未登录'
}
