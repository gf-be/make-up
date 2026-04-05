import request from '@/utils/request'

// 仪表板
export const getDashboardStats = () => {
  return request.get('/dashboard/stats')
}

export const getDashboardTrends = () => {
  return request.get('/dashboard/trends')
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

export const deleteAnnouncement = (id) => {
  return request.delete(`/announcements/${id}`)
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

export const getUnqualifiedCompanies = (params) => {
  return request.get('/companies/unqualified/list', { params })
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

export const getSupervisionStats = () => {
  return request.get('/supervisions/stats/overview')
}
