<template>
  <el-container class="main-layout">
    <!-- 窄屏抽屉遮罩:点空白处收起菜单 -->
    <div v-if="drawerOpen" class="drawer-mask" @click="drawerOpen = false" />
    <el-aside
      :width="isNarrow ? '220px' : (collapsed ? '64px' : '220px')"
      class="sidebar"
      :class="{ 'drawer-open': drawerOpen }"
    >
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
          <!-- 窄屏用汉堡按钮唤出侧边栏抽屉 -->
          <el-icon v-if="isNarrow" class="collapse-btn" @click="drawerOpen = !drawerOpen">
            <Menu />
          </el-icon>
          <el-icon v-else class="collapse-btn" @click="collapsed = !collapsed">
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
      <el-main class="content" :class="{ 'has-bottom-nav': isNarrow }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <!-- 手机端底部固定导航:高频入口一步切换,无需每次展开抽屉 -->
    <nav v-if="isNarrow" class="bottom-nav">
      <button
        v-for="item in bottomTabs"
        :key="item.path"
        class="bottom-tab"
        :class="{ active: isTabActive(item) }"
        @click="onTabClick(item)"
      >
        <span class="tab-icon-wrap">
          <el-icon :size="21"><component :is="item.icon" /></el-icon>
          <span v-if="item.path === notificationPath && unreadCount > 0" class="tab-dot">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
        </span>
        <span class="tab-label">{{ item.title }}</span>
      </button>
    </nav>

    <PasswordDialog v-model:visible="pwdVisible" />
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { Menu } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { NotificationsApi } from '@/api';
import { unreadCountOf, onNoticeReadChanged } from '@/utils/noticeRead';
import PasswordDialog from '@/components/PasswordDialog.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const collapsed = ref(false);
const pwdVisible = ref(false);
const unreadCount = ref(0);
// 窄屏(手机)下侧边栏默认收起,点击汉堡按钮以抽屉形式滑出
const isNarrow = ref(typeof window !== 'undefined' && window.innerWidth <= 768);
const drawerOpen = ref(false);
function onResize() {
  isNarrow.value = window.innerWidth <= 768;
  if (!isNarrow.value) drawerOpen.value = false;
}

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

// 铃铛对所有角色统一进消息中心(导师此前会跳到看板,看不到通知)
const notificationPath = '/student/notifications';

const activeMenu = computed(() => route.path);

// 菜单项按角色动态生成
const menuItems = computed(() => {
  if (auth.isStudent) {
    return [
      { path: '/student/dashboard', title: '考研首页', icon: 'HomeFilled' },
      { path: '/student/mentor-select', title: '我的指导老师', icon: 'User' },
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
      { path: '/student/notifications', title: '我的消息', icon: 'Bell' },
    ];
  }
  // 管理员
  return [
    { path: '/mentor/dashboard', title: '考研看板', icon: 'DataLine' },
    { path: '/mentor/checkin-stats', title: '打卡统计', icon: 'Calendar' },
    { path: '/mentor/students', title: '学生列表', icon: 'UserFilled' },
    { path: '/mentor/alerts', title: '异常预警', icon: 'Warning' },
    { path: '/student/notifications', title: '我的消息', icon: 'Bell' },
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

// 手机底部导航:每个角色 4 个高频入口,「更多」用于展开完整抽屉菜单
const bottomTabs = computed(() => {
  if (auth.isStudent) {
    return [
      { path: '/student/dashboard', title: '首页', icon: 'HomeFilled' },
      { path: '/student/checkin', title: '打卡', icon: 'EditPen' },
      { path: notificationPath, title: '消息', icon: 'Bell' },
      { path: '/student/archive', title: '我的', icon: 'User' },
    ];
  }
  return [
    { path: '/mentor/dashboard', title: '看板', icon: 'DataLine' },
    { path: '/mentor/students', title: '学生', icon: 'UserFilled' },
    { path: notificationPath, title: '消息', icon: 'Bell' },
    { path: '__more__', title: '更多', icon: 'Menu' },
  ];
});

// 当前底栏项是否选中;支持分组路径前缀匹配
function isTabActive(item: { path: string }) {
  if (item.path === '__more__') return false;
  return route.path === item.path;
}

function onTabClick(item: { path: string }) {
  if (item.path === '__more__') {
    drawerOpen.value = true;
    return;
  }
  drawerOpen.value = false;
  if (route.path !== item.path) router.push(item.path);
}

function handleSelect(path: string) {
  drawerOpen.value = false; // 手机端点完菜单自动收起抽屉
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

let unreadTimer: ReturnType<typeof setInterval> | undefined;
let offReadChanged: (() => void) | undefined;

async function loadUnread() {
  if (!auth.user?.id) return;
  try {
    // 拉全量(测试期消息量小)ID,结合本地已读记录算出真实未读数
    const res: any = await NotificationsApi.inbox({ page: 1, pageSize: 500 });
    const items: any[] = res?.items || [];
    unreadCount.value = unreadCountOf(auth.user.id, items.map((n) => Number(n.id)));
  } catch {
    /* 静默 */
  }
}

onMounted(() => {
  loadUnread();
  onResize();
  window.addEventListener('resize', onResize);
  // 消息页标记已读后即时同步角标
  offReadChanged = onNoticeReadChanged(loadUnread);
  // 每 60 秒刷新一次(新消息到达)
  unreadTimer = setInterval(loadUnread, 60000);
});
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  if (unreadTimer) clearInterval(unreadTimer);
  offReadChanged?.();
});
</script>

<style scoped>
.main-layout { height: 100vh; position: relative; }
.sidebar {
  background-color: #001529;
  transition: width 0.2s, transform 0.25s;
  overflow-x: hidden;
}
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1900;
}
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 2000;
    transform: translateX(-100%);
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.25);
  }
  .sidebar.drawer-open { transform: translateX(0); }
  .main-layout > .el-container { width: 100% !important; }
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

/* 手机底部导航 */
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 58px;
  display: flex;
  background: #fff;
  border-top: 1px solid #ebeef5;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 1500;
  padding-bottom: env(safe-area-inset-bottom);
}
.content.has-bottom-nav { padding-bottom: 74px; }
.bottom-tab {
  flex: 1;
  border: none;
  background: transparent;
  color: #909399;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.bottom-tab.active { color: #409eff; }
.tab-icon-wrap { position: relative; display: inline-flex; }
.tab-label { font-size: 11px; line-height: 1.2; }
.tab-dot {
  position: absolute;
  top: -6px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #f56c6c;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}
</style>
