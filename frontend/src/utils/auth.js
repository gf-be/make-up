import { ref } from 'vue'

export const ROLE_LABELS = {
  system_admin: '系统管理员',
  developer: '开发管理员',
  data_admin: '数据管理员',
  normal_user: '普通用户'
}

export const MODULE_PERMISSIONS = {
  system_admin: ['profile', 'admin-users'],
  developer: ['home', 'unqualified-products', 'products-manage', 'pivot-analysis', 'sampling-search', 'announcement-staging', 'announcements', 'announcements-manage', 'inspections', 'companies', 'companies-manage', 'category-manage', 'unqualified-companies', 'supervisions'],
  // data_admin: ['home', 'announcement-staging', 'announcements', 'companies', 'unqualified-companies'],
  data_admin: ['announcement-staging', 'companies-manage', 'category-manage','announcements-manage'],
  // normal_user: ['home', 'unqualified-products', 'inspections', 'companies','supervisions']
  normal_user: ['unqualified-products', 'companies']
}

const AUTH_STORAGE_KEY = 'cosmetics_current_user'
const TOKEN_STORAGE_KEY = 'cosmetics_auth_token'

/**
 * 登录态仅依赖浏览器本地存储（localStorage），不根据服务端会话/cookie 推断是否已登录。
 * 路由与 UI 以本地 token + 用户信息为准；无有效本地缓存则进入登录页。
 */
function authStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** 旧版曾使用 sessionStorage；若 localStorage 尚无登录态则迁入，便于升级后仍保持登录 */
function migrateFromSessionStorage() {
  try {
    const ls = authStorage()
    const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null
    if (!ls || !ss) return
    if (ls.getItem(TOKEN_STORAGE_KEY) || ls.getItem(AUTH_STORAGE_KEY)) return

    const token = ss.getItem(TOKEN_STORAGE_KEY)
    const userJson = ss.getItem(AUTH_STORAGE_KEY)
    if (token == null && userJson == null) return

    if (token != null) ls.setItem(TOKEN_STORAGE_KEY, token)
    if (userJson != null) ls.setItem(AUTH_STORAGE_KEY, userJson)
    ss.removeItem(TOKEN_STORAGE_KEY)
    ss.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* 隐私模式 / 禁用存储 */
  }
}

/** token 与用户信息需成对存在，否则视为未登录，避免仅依赖不完整本地状态 */
function ensureStoredAuthConsistent() {
  const store = authStorage()
  if (!store) return
  try {
    const token = String(store.getItem(TOKEN_STORAGE_KEY) || '').trim()
    const raw = store.getItem(AUTH_STORAGE_KEY)
    let user = null
    try {
      user = JSON.parse(raw || 'null')
    } catch {
      user = null
    }
    const hasToken = token.length > 0
    const hasUser = user != null && typeof user === 'object'
    if (hasToken !== hasUser) {
      store.removeItem(TOKEN_STORAGE_KEY)
      store.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

migrateFromSessionStorage()
ensureStoredAuthConsistent()

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
  const ls = authStorage()
  try {
    if (ls) {
      ls.setItem(TOKEN_STORAGE_KEY, token || '')
      ls.setItem(AUTH_STORAGE_KEY, JSON.stringify(user || null))
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
  currentUser.value = user || null
}

export function clearAuthSession() {
  try {
    const ls = authStorage()
    if (ls) {
      ls.removeItem(TOKEN_STORAGE_KEY)
      ls.removeItem(AUTH_STORAGE_KEY)
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
    }
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
  'announcements-manage': '/announcements-manage',
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
    'announcements-manage',
    'companies-manage',
    'products-manage',
    'unqualified-products',
    'companies',
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
