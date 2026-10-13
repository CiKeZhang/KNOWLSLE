import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截:附加 token
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kygl_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// 响应拦截:统一处理 { success, code, message, data }
http.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) return data.data;
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }
    return data;
  },
  (error: AxiosError<{ message?: string; detail?: unknown }>) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem('kygl_token');
        localStorage.removeItem('kygl_user');
        ElMessage.warning('登录已失效,请重新登录');
        router.push('/login');
      } else {
        ElMessage.error(data?.message || `请求错误(${status})`);
      }
    } else if (error.request) {
      ElMessage.error('网络异常,请检查网络连接');
    } else {
      ElMessage.error(error.message);
    }
    return Promise.reject(error);
  },
);

export default http;

// ============ 业务 API 封装 ============

export const AuthApi = {
  login: (username: string, password: string) =>
    http.post('/auth/login', { username, password }),
  profile: () => http.get('/auth/profile'),
  changePassword: (oldPassword: string, newPassword: string) =>
    http.post('/auth/change-password', { oldPassword, newPassword }),
  bootstrapAdmin: (username: string, password: string, name: string) =>
    http.post('/auth/bootstrap-admin', { username, password, name }),
};

export const CheckInApi = {
  rule: () => http.get('/checkin/rule'),
  myWeekStatus: () => http.get('/checkin/me/week-status'),
  submit: (data: any) => http.post('/checkin/me/submit', data),
  applyMakeup: (data: any) => http.post('/checkin/me/makeup', data),
  myHistory: () => http.get('/checkin/me/history'),
  mentorStats: (params?: any) => http.get('/checkin/mentor/stats', { params }),
  mentorMissing: (params?: any) => http.get('/checkin/mentor/missing', { params }),
  makeupApplications: (params?: any) =>
    http.get('/checkin/mentor/makeup-applications', { params }),
  approveMakeup: (id: number, data: any) =>
    http.patch(`/checkin/mentor/makeup-applications/${id}/approve`, data),
  studentHistory: (id: number) => http.get(`/checkin/student/${id}/history`),
};

export const ProgressApi = {
  myArchive: () => http.get('/progress/me'),
  updateArchive: (data: any) => http.patch('/progress/me/archive', data),
  updateProfile: (data: any) => http.patch('/progress/me/profile', data),
  updateStage: (data: any) => http.patch('/progress/me/stage', data),
  keyNodes: () => http.get('/progress/key-nodes'),
  studentArchive: (id: number) => http.get(`/progress/student/${id}`),
};

export const AiApi = {
  recommend: (data: any) => http.post('/ai/recommend', data),
  myRecommendations: () => http.get('/ai/me/recommendations'),
  feedback: (id: number, data: any) =>
    http.post(`/ai/recommendations/${id}/feedback`, data),
};

export const StudyPlanApi = {
  weekly: () => http.get('/study-plan/me/weekly'),
  monthly: () => http.get('/study-plan/me/monthly'),
  regenerate: () => http.post('/study-plan/me/regenerate'),
  update: (id: number, data: any) => http.patch(`/study-plan/${id}`, data),
  toggle: (id: number, data: any) => http.patch(`/study-plan/${id}/toggle`, data),
};


export const MentorApi = {
  dashboard: (params?: any) => http.get('/mentor/dashboard', { params }),
  students: (params?: any) => http.get('/mentor/students', { params }),
  alerts: (params?: any) => http.get('/mentor/alerts', { params }),
  handleAlert: (id: number) => http.patch(`/mentor/alerts/${id}/handle`),
  watch: (studentId: number, note?: string) =>
    http.post(`/mentor/watch/${studentId}`, { note }),
  unwatch: (studentId: number) => http.delete(`/mentor/watch/${studentId}`),
  watched: () => http.get('/mentor/watched'),
  helpApplications: (params?: any) =>
    http.get('/mentor/help-applications', { params }),
  assignHelp: (id: number) => http.post(`/mentor/help-applications/${id}/assign`),
  recordHelp: (id: number, data: any) =>
    http.post(`/mentor/help-applications/${id}/record`, data),
  batchNotify: (data: any) => http.post('/mentor/batch-notify', data),
};

export const HelpApi = {
  apply: (data: any) => http.post('/help/apply', data),
  applyFromCheckIn: (data: any) => http.post('/help/apply-from-checkin', data),
  myApplications: () => http.get('/help/me/applications'),
  detail: (id: number) => http.get(`/help/applications/${id}`),
};

export const ResourcesApi = {
  list: (params?: any) => http.get('/resources', { params }),
  view: (id: number) => http.get(`/resources/${id}`),
  create: (data: any) => http.post('/resources', data),
  review: (id: number, status: string) =>
    http.patch(`/resources/${id}/review`, { status }),
  offline: (id: number) => http.patch(`/resources/${id}/offline`),
  pendingReview: () => http.get('/resources/admin/pending-review'),
};

export const ReportsApi = {
  summary: (params?: any) => http.get('/reports/summary', { params }),
  exportCheckinExcel: (params?: any) =>
    http.get('/reports/export/checkin-excel', {
      params,
      responseType: 'blob',
    }),
  exportProgressPdf: (params?: any) =>
    http.get('/reports/export/progress-pdf', {
      params,
      responseType: 'blob',
    }),
  checkinAnalysis: (params?: any) =>
    http.get('/reports/checkin-analysis', { params }),
};

export const NotificationsApi = {
  inbox: (params?: any) => http.get('/notifications/inbox', { params }),
};

export const AdminApi = {
  getCheckInRule: () => http.get('/admin/checkin-rule'),
  updateCheckInRule: (data: any) => http.patch('/admin/checkin-rule', data),
  listSchools: (params?: any) => http.get('/admin/schools', { params }),
  createSchool: (data: any) => http.post('/admin/schools', data),
  updateSchool: (id: number, data: any) => http.patch(`/admin/schools/${id}`, data),
  listPrograms: (schoolId: number) =>
    http.get(`/admin/schools/${schoolId}/programs`),
  createProgram: (schoolId: number, data: any) =>
    http.post(`/admin/schools/${schoolId}/programs`, data),
  updateProgram: (id: number, data: any) =>
    http.patch(`/admin/programs/${id}`, data),
  listConfigs: () => http.get('/admin/configs'),
  getConfig: (key: string) => http.get(`/admin/configs/${key}`),
  updateConfig: (key: string, value: any, description: string) =>
    http.patch(`/admin/configs/${key}`, { value, description }),
  listKeyNodes: () => http.get('/admin/key-nodes'),
  updateKeyNode: (id: number, data: any) =>
    http.patch(`/admin/key-nodes/${id}`, data),
  listDepartments: () => http.get('/admin/departments'),
  createDepartment: (data: any) => http.post('/admin/departments', data),
  listMajors: (departmentId?: number) =>
    http.get('/admin/majors', { params: { departmentId } }),
  createMajor: (data: any) => http.post('/admin/majors', data),
  listClasses: (params?: any) => http.get('/admin/classes', { params }),
  createClass: (data: any) => http.post('/admin/classes', data),
  operationLogs: (params?: any) => http.get('/admin/operation-logs', { params }),
  listBackups: () => http.get('/admin/backup/list'),
  createBackup: () => http.post('/admin/backup/create'),
  restoreBackup: (filename: string) => http.post(`/admin/backup/restore/${encodeURIComponent(filename)}`),
};

export const UsersApi = {
  list: (params?: any) => http.get('/users', { params }),
  detail: (id: number) => http.get(`/users/${id}`),
  create: (data: any) => http.post('/users', data),
  update: (id: number, data: any) => http.patch(`/users/${id}`, data),
  remove: (id: number) => http.delete(`/users/${id}`),
  batchImport: (items: any[]) => http.post('/users/batch-import', { items }),
};
