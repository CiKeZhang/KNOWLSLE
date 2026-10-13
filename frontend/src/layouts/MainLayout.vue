<template>
  <el-container class="main-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <span v-if="!collapsed">考研进度管控系统</span>
        <span v-else>考研</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :router="false"
        @select="handleSelect"
        background-color="#001529"
        text-color="#e5e7eb"
        active-text-color="#409eff"
      >
        <template v-for="item in menuItems" :key="item.path">
          <el-sub-menu v-if="item.children" :index="item.path">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.path"
              :index="child.path"
            >
              <el-icon><component :is="child.icon" v-if="child.icon" /></el-icon>
              <span>{{ child.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div class="topbar-left">
          <el-icon class="collapse-btn" @click="collapsed = !collapsed">
            <Fold v-if="!collapsed" />
            <Expand v-else />
          </el-icon>
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="badge-wrap">
            <el-icon @click="$router.push(notificationPath)"><Bell /></el-icon>
          </el-badge>
        </div>
        <div class="topbar-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><User /></el-icon>
              <span class="ml-8">{{ auth.user?.name }} ({{ roleLabel }})</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人资料</el-dropdown-item>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <PasswordDialog v-model:visible="pwdVisible" />
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { NotificationsApi } from '@/api';
import PasswordDialog from '@/components/PasswordDialog.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const collapsed = ref(false);
const pwdVisible = ref(false);
const unreadCount = ref(0);

const roleLabel = computed(() => {
  const m: Record<string, string> = {
    STUDENT: '学生',
    COUNSELOR: '辅导员',
    MAJOR_MENTOR: '专业导师',
    ACADEMIC_ADMIN: '教学管理员',
    SYS_ADMIN: '系统管理员',
  };
  return m[auth.role] || auth.role;
});

const notificationPath = computed(() =>
  auth.isStudent ? '/student/notifications' : '/mentor/dashboard',
);

const activeMenu = computed(() => route.path);

// 菜单项按角色动态生成
const menuItems = computed(() => {
  if (auth.isStudent) {
    return [
      { path: '/student/dashboard', title: '考研首页', icon: 'HomeFilled' },
      { path: '/student/checkin', title: '本周打卡', icon: 'EditPen' },
      { path: '/student/archive', title: '我的档案', icon: 'Document' },
      { path: '/student/ai', title: 'AI 择校', icon: 'MagicStick' },
      { path: '/student/resources', title: '备考资源', icon: 'FolderOpened' },
      { path: '/student/plan', title: '备考计划', icon: 'Calendar' },
      { path: '/student/help', title: '学业帮扶', icon: 'ChatLineRound' },
      { path: '/student/notifications', title: '我的消息', icon: 'Bell' },
    ];
  }
  if (auth.isCounselor || auth.isMajorMentor) {
    return [
      { path: '/mentor/dashboard', title: '考研看板', icon: 'DataLine' },
      { path: '/mentor/checkin-stats', title: '打卡统计', icon: 'Calendar' },
      { path: '/mentor/students', title: '学生列表', icon: 'UserFilled' },
      { path: '/mentor/alerts', title: '异常预警', icon: 'Warning' },
      { path: '/mentor/makeup', title: '补卡审批', icon: 'DocumentChecked' },
      { path: '/mentor/help', title: '帮扶管理', icon: 'ChatLineRound' },
      { path: '/mentor/reports', title: '报表导出', icon: 'Download' },
    ];
  }
  // 管理员
  return [
    { path: '/mentor/dashboard', title: '考研看板', icon: 'DataLine' },
    { path: '/mentor/checkin-stats', title: '打卡统计', icon: 'Calendar' },
    { path: '/mentor/students', title: '学生列表', icon: 'UserFilled' },
    { path: '/mentor/alerts', title: '异常预警', icon: 'Warning' },
    {
      path: 'admin',
      title: '后台管理',
      icon: 'Setting',
      children: [
        { path: '/admin/users', title: '账号管理', icon: 'User' },
        { path: '/admin/import', title: '批量导入', icon: 'Upload' },
        { path: '/admin/checkin-rule', title: '打卡规则', icon: 'Tools' },
        { path: '/admin/schools', title: '院校数据库', icon: 'School' },
        { path: '/admin/resources', title: '资源库', icon: 'FolderOpened' },
        { path: '/admin/configs', title: '系统配置', icon: 'Setting' },
        { path: '/admin/logs', title: '操作日志', icon: 'Tickets' },
        { path: '/admin/backups', title: '数据备份', icon: 'Files' },
      ],
    },
  ];
});

function handleSelect(path: string) {
  router.push(path);
}

async function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    try {
      await ElMessageBox.confirm('确认退出登录?', '提示', { type: 'warning' });
      auth.logout();
      router.push('/login');
    } catch {
      /* 取消 */
    }
  } else if (cmd === 'password') {
    pwdVisible.value = true;
  } else if (cmd === 'profile') {
    router.push(auth.isStudent ? '/student/archive' : '/mentor/dashboard');
  }
}

async function loadUnread() {
  try {
    const res: any = await NotificationsApi.inbox({ page: 1, pageSize: 1 });
    unreadCount.value = res?.total ?? 0;
  } catch {
    /* 静默 */
  }
}

onMounted(() => {
  loadUnread();
  // 每 60 秒刷新一次未读数
  setInterval(loadUnread, 60000);
});
</script>

<style scoped>
.main-layout { height: 100vh; }
.sidebar {
  background-color: #001529;
  transition: width 0.2s;
  overflow-x: hidden;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #1f3a5f;
}
.sidebar :deep(.el-menu) {
  border-right: none;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  padding: 0 16px;
}
.topbar-left { display: flex; align-items: center; gap: 16px; }
.collapse-btn { cursor: pointer; font-size: 20px; }
.badge-wrap { display: flex; align-items: center; }
.badge-wrap :deep(.el-badge__content) { font-size: 11px; }
.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.content { background: var(--kygl-bg); padding: 16px; overflow-y: auto; }
.ml-8 { margin-left: 8px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
