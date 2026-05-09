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

/** 登录态用 sessionStorage：同站点下每个浏览器标签页独立会话，可多账号同时在线且互不影响。 */
function authStorage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/**
 * 历史版本将 token 存在 localStorage（全标签页共享）。首次加载时若当前标签 session 为空则迁入并清空 localStorage，避免旧行为与多标签多用户冲突。
 */
function migrateLegacyAuthFromLocalStorage() {
  try {
    const ls = localStorage
    const ss = authStorage()
    if (!ss) return
    const existingToken = ss.getItem(TOKEN_STORAGE_KEY)
    const existingUser = ss.getItem(AUTH_STORAGE_KEY)
    if (existingToken != null || existingUser != null) return

    const token = ls.getItem(TOKEN_STORAGE_KEY)
    const userJson = ls.getItem(AUTH_STORAGE_KEY)
    if (token == null && userJson == null) return

    if (token != null) ss.setItem(TOKEN_STORAGE_KEY, token)
    if (userJson != null) ss.setItem(AUTH_STORAGE_KEY, userJson)
    ls.removeItem(TOKEN_STORAGE_KEY)
    ls.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* 隐私模式 / 禁用存储 */
  }
}

migrateLegacyAuthFromLocalStorage()

function readStoredUser() {
  const ss = authStorage()
  try {
    if (!ss) return null
    return JSON.parse(ss.getItem(AUTH_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export const currentUser = ref(readStoredUser())

export function getAuthToken() {
  try {
    return authStorage()?.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setAuthSession(token, user) {
  const ss = authStorage()
  try {
    if (ss) {
      ss.setItem(TOKEN_STORAGE_KEY, token || '')
      ss.setItem(AUTH_STORAGE_KEY, JSON.stringify(user || null))
    }
  } catch {
    /* ignore */
  }
  currentUser.value = user || null
}

export function clearAuthSession() {
  try {
    const ss = authStorage()
    if (ss) {
      ss.removeItem(TOKEN_STORAGE_KEY)
      ss.removeItem(AUTH_STORAGE_KEY)
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  currentUser.value = null
}

/**
 * localStorage 中的业务偏好按用户隔离（同一浏览器先后登录不同账号时不串读）。
 * @param {string} baseKey
 * @param {object | null | undefined} user 默认当前登录用户
 */
export function getUserScopedStorageKey(baseKey, user = currentUser.value) {
  if (user?.id != null && user.id !== '') {
    return `${baseKey}::id:${user.id}`
  }
  if (user?.username) {
    return `${baseKey}::u:${String(user.username)}`
  }
  return `${baseKey}::__guest__`
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
