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

export const updateCurrentUserProfile = (data) => {
  return request.put('/auth/me', data)
}

/** 当前账号已关联保存的不合格产品层级方案（服务端） */
export const listMyUnqualifiedDimensionPresets = (params) => {
  return request.get('/auth/me/unqualified-dimension-presets', { params })
}

/** 保存一套层级方案：写入标题表并写入用户关联表 */
export const createMyUnqualifiedDimensionPreset = (data) => {
  return request.post('/auth/me/unqualified-dimension-presets', data)
}

export const deleteMyUnqualifiedDimensionPreset = (id) => {
  return request.delete(`/auth/me/unqualified-dimension-presets/${id}`)
}

export const listAdminUsers = () => {
  return request.get('/auth/users')
}

export const createAdminUser = (data) => {
  return request.post('/auth/users', data)
}

export const updateAdminUser = (id, data = {}) => {
  return request.patch(`/auth/users/${id}`, data)
}

export const deleteAdminUser = (id) => {
  return request.delete(`/auth/users/${id}`)
}

export const getOperationLogs = (params) => {
  return request.get('/auth/operation-logs', { params })
}

export const createOperationLog = (data) => {
  return request.post('/auth/operation-logs', data)
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

export const getAnnouncementStagingFilterYears = (params) => {
  return request.get('/announcement-staging/filter-years', { params })
}

export const getAnnouncementStagingDetail = (id) => {
  return request.get(`/announcement-staging/${id}`)
}

export const createAnnouncementStagingItem = (id, data = {}) => {
  return request.post(`/announcement-staging/${id}/items`, data)
}

export const updateAnnouncementStagingItem = (id, data = {}) => {
  return request.put(`/announcement-staging/${id}/items`, data)
}

export const deleteAnnouncementStagingItem = (id, data = {}) => {
  return request.delete(`/announcement-staging/${id}/items`, { data })
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

export const updateAnnouncementStagingInfo = (id, data = {}) => {
  return request.put(`/announcement-staging/${id}/info`, data)
}

export const syncAnnouncementStagingItems = (id) => {
  return request.post(`/announcement-staging/${id}/sync-items`)
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

export const getCompanyDetail = (id, params = {}) => {
  return request.get(`/companies/${id}`, { params })
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

export const getUnqualifiedProductNodeDetailChart = (data, config = {}) => {
  return request.post('/unqualified-products/node-detail-chart', data, config)
}

export const getUnqualifiedProductCheckedTreeNodes = (data, config = {}) => {
  return request.post('/unqualified-products/checked-tree-nodes', data, config)
}

export const getUnqualifiedProductDetail = (id) => {
  return request.get(`/unqualified-products/${id}`)
}

/** 数据/开发管理员：管理页专用详情（含拆分表） */
export const getManageUnqualifiedProductDetail = (id) => {
  return request.get(`/unqualified-products/manage/record/${id}`)
}

export const listManageUnqualifiedProducts = (params) => {
  return request.get('/unqualified-products/manage/list', { params })
}

export const createManageUnqualifiedProduct = (data) => {
  return request.post('/unqualified-products/manage', data)
}

export const updateManageUnqualifiedProduct = (id, data) => {
  return request.put(`/unqualified-products/manage/${id}`, data)
}

export const deleteManageUnqualifiedProduct = (id) => {
  return request.delete(`/unqualified-products/manage/${id}`)
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

export const getUnqualifiedProductUsageRecords = (id, params) => {
  return request.get(`/unqualified-products/${id}/usage-records`, { params })
}

/** 保存文案：写入文案表并在关联明细上追加「使用用户」记录 */
export const saveUnqualifiedProductCopyText = (data) => {
  return request.post('/unqualified-products/save-copy-text', data)
}

/** 数据管理员：按产品类型维护产品分类词条 */
export const getCategoryCatalogProductTypes = () => {
  return request.get('/category-catalog/product-types')
}

export const listCategoryCatalog = (params) => {
  return request.get('/category-catalog/list', { params })
}

export const createCategoryCatalog = (data) => {
  return request.post('/category-catalog', data)
}

export const createCategoryCatalogProductType = (data) => {
  return request.post('/category-catalog/product-types', data)
}

export const listCategoryCatalogProducts = (params) => {
  return request.get('/category-catalog/category-products', { params })
}

export const assignCategoryCatalogProduct = (data) => {
  return request.post('/category-catalog/assign-product-category', data)
}

export const deleteCategoryCatalog = (id) => {
  return request.delete(`/category-catalog/${id}`)
}

export const listCategoryAbstractProducts = (params) => {
  return request.get('/category-catalog/abstract-products', { params })
}

export const createCategoryAbstractProduct = (data) => {
  return request.post('/category-catalog/abstract-products', data)
}

export const updateCategoryAbstractProduct = (id, data) => {
  return request.put(`/category-catalog/abstract-products/${id}`, data)
}

export const deleteCategoryAbstractProduct = (id) => {
  return request.delete(`/category-catalog/abstract-products/${id}`)
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

export const bulkImportCompanyCreditCodes = (data) => {
  return request.post('/companies/bulk-credit-codes', data)
}

/** 批量导入后用户确认企业更名：写 company_name_history 并更新名称 */
export const confirmImportCompanyNameChange = (data) => {
  return request.post('/companies/confirm-import-name-change', data)
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
