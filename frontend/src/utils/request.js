import axios from 'axios'
import { ElMessage } from 'element-plus'
import { clearAuthSession, getAuthToken } from './auth'

const apiBaseURL = (
  import.meta.env.VITE_API_BASE_URL || 'http://47.106.104.48:3003/api'
).replace(/\/$/, '')

const request = axios.create({
  // baseURL: '/api',
  baseURL: apiBaseURL,
  timeout: 30000
})

// 请求拦截器
request.interceptors.request.use(
  config => {
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    if (response.config.responseType === 'blob') {
      return response.data
    }
    const res = response.data
    if (!res || typeof res !== 'object') {
      ElMessage.error('接口返回格式异常，请检查 API 地址是否指向后端服务')
      return Promise.reject(new Error('接口返回格式异常'))
    }
    if (res.success === false) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  error => {
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
      return Promise.reject(error)
    }
    if (error?.response?.status === 401) {
      clearAuthSession()
    }
    ElMessage.error(error?.response?.data?.message || error.message || '网络错误')
    return Promise.reject(error)
  }
)

export default request
