import request from '@/utils/request'

export const login = (data) => {
  return request.post('/auth/login', data)
}

export const registerNormalUser = (data) => {
  return request.post('/auth/register', data)
}

export const logout = () => {
  return request.post('/auth/logout')
}

export const getCurrentUser = () => {
  return request.get('/auth/me')
}

export const updateCurrentUserPassword = (data) => {
  return request.put('/auth/me/password', data)
}

export const getOperationLogs = (params) => {
  return request.get('/auth/operation-logs', { params })
}

export const createOperationLog = (data) => {
  return request.post('/auth/operation-logs', data)
}

// 仪表板
export const getDashboardStats = () => {
  return request.get('/dashboard/stats')
}

export const getDashboardTrends = () => {
  return request.get('/dashboard/trends')
}

export const getPivotAnalysis = (params) => {
  return request.get('/analytics/pivot', { params })
}

// 组合式数据检索（抽检多维检索 / 导出）
export const getSamplingSearchFieldSchema = () => {
  return request.get('/sampling-search/field-schema')
}

export const getSamplingSearchOptions = (params) => {
  return request.get('/sampling-search/options', { params })
}

export const postSamplingSearchQuery = (data) => {
  return request.post('/sampling-search/query', data)
}

export const postSamplingSearchExport = (data) => {
  return request.post('/sampling-search/export', data, { responseType: 'blob' })
}

// 公告（抽样检查公告）
export const getAnnouncements = (params) => {
  return request.get('/announcements', { params })
}

export const getAnnouncementDetail = (id) => {
  return request.get(`/announcements/${id}`)
}

export const getAnnouncementById = (id) => {
  return request.get(`/announcements/${id}`)
}

export const getRelatedInspections = (announcementId) => {
  return request.get(`/announcements/${announcementId}/inspections`)
}

export const getAnnouncementProductDetails = (announcementId, params) => {
  return request.get(`/announcements/${announcementId}/product-details`, { params })
}

export const updateAnnouncementProductDetail = (announcementId, detailId, data) => {
  return request.put(`/announcements/${announcementId}/product-details/${detailId}`, data)
}

export const deleteAnnouncementProductDetail = (announcementId, detailId) => {
  return request.delete(`/announcements/${announcementId}/product-details/${detailId}`)
}

export const createAnnouncement = (formData) => {
  return request.post('/announcements', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const updateAnnouncement = (id, formData) => {
  return request.put(`/announcements/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const updateAnnouncementProductType = (id, data = {}) => {
  return request.patch(`/announcements/${id}/product-type`, data)
}

export const updateAnnouncementContent = (id, data = {}) => {
  return request.patch(`/announcements/${id}/content`, data)
}

export const deleteAnnouncement = (id) => {


  return request.delete(`/announcements/${id}`)
}

export const getAnnouncementStagingOverview = () => {
  return request.get('/announcement-staging/overview')
}

export const getAnnouncementStagingList = (params) => {
  return request.get('/announcement-staging', { params })
}

export const getAnnouncementStagingTree = (params) => {
  return request.get('/announcement-staging/tree', { params })
}

export const getAnnouncementStagingDetail = (id) => {
  return request.get(`/announcement-staging/${id}`)
}

export const getAnnouncementStagingTracebacks = (params) => {
  return request.get('/announcement-staging/tracebacks', { params })
}

export const resolveAnnouncementStagingTraceback = (id) => {
  return request.post(`/announcement-staging/tracebacks/${id}/resolve`)
}

export const deleteAnnouncementStagingTraceback = (id) => {
  return request.delete(`/announcement-staging/tracebacks/${id}`)
}

export const getAnnouncementStagingWorkspaceCache = (params) => {

  return request.get('/announcement-staging/workspace-cache', { params })
}

export const saveAnnouncementStagingWorkspaceCache = (data = {}) => {
  return request.post('/announcement-staging/workspace-cache', data)
}

export const importAnnouncementStagingJson = (data = {}) => {
  return request.post('/announcement-staging/import-json', data)
}

export const uploadAnnouncementStagingJson = (formData) => {
  return request.post('/announcement-staging/import-json-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 120000
  })
}

export const confirmAnnouncementStaging = (id) => {
  return request.post(`/announcement-staging/${id}/confirm`)
}

export const updateAnnouncementStagingBody = (id, data = {}) => {
  return request.put(`/announcement-staging/${id}/body`, data)
}

export const updateAnnouncementStagingProductType = (id, data = {}) => {
  return request.patch(`/announcement-staging/${id}/product-type`, data)
}

export const deleteAnnouncementStagingBatch = (id) => {

  return request.delete(`/announcement-staging/${id}`)
}

export const retreatAnnouncementStagingToTraceback = (id, data = {}) => {

  return request.post(`/announcement-staging/${id}/retreat-to-traceback`, data)
}

export const deletePublishedAnnouncementStaging = (id) => {
  return request.delete(`/announcement-staging/${id}/published`)
}

export const confirmAllAnnouncementStaging = (data = {}) => {


  return request.post('/announcement-staging/confirm-all', data)
}



// 抽样检查

export const getInspections = (params) => {
  return request.get('/inspections', { params })
}

export const getInspectionDetail = (id) => {
  return request.get(`/inspections/${id}`)
}

export const getInspectionStats = () => {
  return request.get('/inspections/stats/overview')
}

// 企业
export const getCompanies = (params) => {
  return request.get('/companies', { params })
}

export const getCompanyDetail = (id) => {
  return request.get(`/companies/${id}`)
}

export const getCompanyStats = () => {
  return request.get('/companies/stats/overview')
}

export const getCompanyFilterOptions = () => {
  return request.get('/companies/filter-options')
}

export const getUnqualifiedCompanies = (params) => {
  return request.get('/companies/unqualified/list', { params })
}

export const getUnqualifiedCompanyFilterOptions = () => {
  return request.get('/companies/unqualified/filter-options')
}

export const getUnqualifiedProducts = (params) => {
  return request.get('/unqualified-products', { params })
}

export const getUnqualifiedProductTree = (params, config = {}) => {
  return request.get('/unqualified-products/tree', { params, ...config })
}

export const getUnqualifiedProductTreeChildren = (params, config = {}) => {
  return request.get('/unqualified-products/tree-children', { params, ...config })
}

export const getUnqualifiedProductNodeDetails = (data, config = {}) => {
  return request.post('/unqualified-products/node-details', data, config)
}

export const getUnqualifiedProductCheckedTreeNodes = (data, config = {}) => {
  return request.post('/unqualified-products/checked-tree-nodes', data, config)
}

export const getUnqualifiedProductDetail = (id) => {
  return request.get(`/unqualified-products/${id}`)
}

export const getUnqualifiedProductStats = () => {
  return request.get('/unqualified-products/stats/overview')
}

export const getUnqualifiedProductFilterOptions = () => {
  return request.get('/unqualified-products/filter-options')
}

export const getUnqualifiedProductSourcesInRange = (params) => {
  return request.get('/unqualified-products', {
    params: { ...params, list_sources: '1' }
  })
}

export const postFoodInspectionImportJson = (data = {}) => {
  return request.post('/food-inspections/import-json', data)
}

export const getFoodInspections = (params) => {
  return request.get('/food-inspections', { params })
}

export const getFoodInspectionDetail = (id) => {
  return request.get(`/food-inspections/${id}`)
}


export const createCompany = (data) => {
  return request.post('/companies', data)
}

export const updateCompany = (id, data) => {
  return request.put(`/companies/${id}`, data)
}

export const deleteCompany = (id) => {
  return request.delete(`/companies/${id}`)
}

// 督查
export const getSupervisions = (params) => {
  return request.get('/supervisions', { params })
}

export const getSupervisionDetail = (id) => {
  return request.get(`/supervisions/${id}`)
}

export const updateSupervisionProductType = (id, data = {}) => {
  return request.patch(`/supervisions/${id}/product-type`, data)
}

export const createSupervision = (formData) => {
  return request.post('/supervisions', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const updateSupervision = (id, formData) => {
  return request.put(`/supervisions/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const deleteSupervision = (id) => {
  return request.delete(`/supervisions/${id}`)
}

export const getSupervisionStats = () => {
  return request.get('/supervisions/stats/overview')
}
