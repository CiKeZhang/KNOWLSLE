import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/redirect',
    children: [
      {
        path: 'redirect',
        component: () => import('@/views/Redirect.vue'),
        meta: { title: '首页' },
      },
      // 学生端
      {
        path: 'student/dashboard',
        component: () => import('@/views/student/Dashboard.vue'),
        meta: { roles: ['STUDENT'], title: '考研首页' },
      },
      {
        // 只读展示学院预分配的导师;学生端已取消自选/更换功能
        path: 'student/mentor-select',
        component: () => import('@/views/student/MentorSelect.vue'),
        meta: { roles: ['STUDENT'], title: '我的指导老师' },
      },
      {
        path: 'student/checkin',
        component: () => import('@/views/student/CheckIn.vue'),
        meta: { roles: ['STUDENT'], title: '本周打卡' },
      },
      {
        path: 'student/archive',
        component: () => import('@/views/student/Archive.vue'),
        meta: { roles: ['STUDENT'], title: '我的考研档案' },
      },
      {
        path: 'student/ai',
        component: () => import('@/views/student/AiRecommend.vue'),
        meta: { roles: ['STUDENT'], title: 'AI 择校推荐' },
      },
      {
        path: 'student/resources',
        component: () => import('@/views/student/Resources.vue'),
        meta: { roles: ['STUDENT'], title: '备考资源' },
      },
      {
        path: 'student/help',
        component: () => import('@/views/student/Help.vue'),
        meta: { roles: ['STUDENT'], title: '学业帮扶' },
      },
      {
        path: 'student/plan',
        component: () => import('@/views/student/StudyPlan.vue'),
        meta: { roles: ['STUDENT'], title: '备考计划' },
      },
      {
        // 消息中心对所有登录角色开放(导师/管理员也要能从铃铛进来看通知)
        path: 'student/notifications',
        component: () => import('@/views/student/Notifications.vue'),
        meta: { title: '我的消息' },
      },
      // 导师端
      {
        path: 'mentor/dashboard',
        component: () => import('@/views/mentor/Dashboard.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '考研进度看板' },
      },
      {
        path: 'mentor/checkin-stats',
        component: () => import('@/views/mentor/CheckInStats.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '周度打卡统计' },
      },
      {
        path: 'mentor/students',
        component: () => import('@/views/mentor/Students.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '学生列表' },
      },
      {
        path: 'mentor/students/:id',
        component: () => import('@/views/mentor/StudentDetail.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '学生详情' },
      },
      {
        path: 'mentor/alerts',
        component: () => import('@/views/mentor/Alerts.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '异常预警' },
      },
      {
        path: 'mentor/help',
        component: () => import('@/views/mentor/Help.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN'], title: '帮扶管理' },
      },
      {
        path: 'mentor/makeup',
        component: () => import('@/views/mentor/MakeupApproval.vue'),
        meta: { roles: ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN'], title: '补卡审批' },
      },
      {
        path: 'mentor/reports',
        component: () => import('@/views/mentor/Reports.vue'),
        meta: { roles: ['ACADEMIC_ADMIN', 'SYS_ADMIN', 'COUNSELOR', 'MAJOR_MENTOR'], title: '报表导出' },
      },
      // 后台管理
      {
        path: 'admin/users',
        component: () => import('@/views/admin/Users.vue'),
        meta: { roles: ['ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '账号管理' },
      },
      {
        path: 'admin/import',
        component: () => import('@/views/admin/BatchImport.vue'),
        meta: { roles: ['ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '批量导入' },
      },
      {
        path: 'admin/checkin-rule',
        component: () => import('@/views/admin/CheckInRule.vue'),
        meta: { roles: ['ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '打卡规则' },
      },
      {
        path: 'admin/schools',
        component: () => import('@/views/admin/Schools.vue'),
        meta: { roles: ['ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '院校数据库' },
      },
      {
        path: 'admin/resources',
        component: () => import('@/views/admin/Resources.vue'),
        meta: { roles: ['ACADEMIC_ADMIN', 'SYS_ADMIN'], title: '资源库管理' },
      },
      {
        path: 'admin/configs',
        component: () => import('@/views/admin/Configs.vue'),
        meta: { roles: ['SYS_ADMIN'], title: '系统配置' },
      },
      {
        path: 'admin/logs',
        component: () => import('@/views/admin/OperationLogs.vue'),
        meta: { roles: ['SYS_ADMIN'], title: '操作日志' },
      },
      {
        path: 'admin/backups',
        component: () => import('@/views/admin/Backups.vue'),
        meta: { roles: ['SYS_ADMIN'], title: '数据备份' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/NotFound.vue'),
    meta: { public: true, title: '404' },
  },
];

const router = createRouter({
  // 静态站点无服务端 fallback,使用 hash 模式避免刷新 404
  history: createWebHashHistory(),
  routes,
});

// 全局守卫: 鉴权 + 角色校验 + 学生自选导师引导
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  document.title = (to.meta.title as string) ?? '学院考研进度管控系统';

  if (to.meta.public) return true;

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  const requiredRoles = to.meta.roles as string[] | undefined;
  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(auth.role)) {
    return { path: '/' };
  }

  // 导师由学院统一预分配,不再做学生自选/登录引导
  return true;
});

export default router;
