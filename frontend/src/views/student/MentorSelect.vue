<template>
  <div class="mentor-select">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div>
          <h2>选择指导老师</h2>
          <p class="desc">
            测试期采用学生自选导师。选择后老师才能在「学生列表」中看到你的打卡与备考档案，可随时更换。
          </p>
        </div>
        <el-tag v-if="currentMentor" type="success" size="large" effect="light">
          当前导师：{{ currentMentor.name }}
        </el-tag>
        <el-tag v-else type="warning" size="large" effect="light">尚未选择</el-tag>
      </div>
    </el-card>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="按姓名或工号搜索"
        clearable
        :prefix-icon="Search"
        style="max-width: 320px"
      />
      <span class="count">共 {{ filtered.length }} 位可选老师</span>
    </div>

    <div v-loading="loading" class="grid">
      <el-card
        v-for="m in filtered"
        :key="m.id"
        shadow="hover"
        class="mentor-card"
        :class="{ selected: isSelected(m) }"
      >
        <div class="avatar">{{ m.name ? m.name.charAt(0) : '师' }}</div>
        <div class="info">
          <div class="name">
            {{ m.name }}
            <el-tag v-if="isSelected(m)" size="small" type="success">已选</el-tag>
          </div>
          <div class="meta">工号：{{ m.staffNo || '—' }}</div>
          <div class="meta">专业方向：{{ m.majorName || '未填写' }}</div>
        </div>
        <el-button
          :type="isSelected(m) ? 'info' : 'primary'"
          :disabled="isSelected(m) || submitting"
          @click="choose(m)"
        >
          {{ isSelected(m) ? '当前导师' : currentMentor ? '改选' : '选择' }}
        </el-button>
      </el-card>
      <el-empty v-if="!loading && filtered.length === 0" description="没有匹配的老师" />
    </div>

    <div class="footer-bar">
      <el-button text type="info" @click="skip">暂不选择，先进入首页</el-button>
      <span class="tip">未选择导师时，老师端看不到你的数据。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { MentorSelectionApi } from '@/api';
import { useAuthStore } from '@/stores/auth';

// 与 router 中的引导页路径保持一致(不反向 import router,避免循环依赖)
const MENTOR_SELECT_PATH = '/student/mentor-select';

interface MentorOption {
  id: number;
  name: string;
  staffNo?: string | null;
  majorName?: string | null;
}

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const keyword = ref('');
const mentors = ref<MentorOption[]>([]);
const currentMentor = ref<{ id: number; name: string } | null>(null);

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return mentors.value;
  return mentors.value.filter(
    (m) =>
      (m.name || '').toLowerCase().includes(kw) ||
      (m.staffNo || '').toLowerCase().includes(kw),
  );
});

function isSelected(m: MentorOption) {
  return !!currentMentor.value && currentMentor.value.id === m.id;
}

function targetPath() {
  const redirect = route.query.redirect as string | undefined;
  if (!redirect || redirect === MENTOR_SELECT_PATH || redirect.startsWith(MENTOR_SELECT_PATH)) {
    return '/student/dashboard';
  }
  return redirect;
}

async function loadData() {
  loading.value = true;
  try {
    const [options, mine]: any[] = await Promise.all([
      MentorSelectionApi.options(),
      MentorSelectionApi.myMentor(),
    ]);
    mentors.value = Array.isArray(options) ? options : [];
    currentMentor.value = mine ?? null;
    auth.setMentorSelected(!!mine);
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}

async function choose(m: MentorOption) {
  if (submitting.value || isSelected(m)) return;
  try {
    await ElMessageBox.confirm(
      `确定选择「${m.name}」老师作为你的指导老师吗？`,
      currentMentor.value ? '更换导师' : '确认选择',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await MentorSelectionApi.select(m.id);
    ElMessage.success('选择成功');
    auth.setMentorSelected(true);
    router.push(targetPath());
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    submitting.value = false;
  }
}

function skip() {
  sessionStorage.setItem('kygl_skip_mentor', '1');
  router.push(targetPath());
}

onMounted(loadData);
</script>

<style scoped>
.mentor-select { max-width: 1100px; margin: 0 auto; }
.header-card { margin-bottom: 16px; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.header-row h2 { margin: 0 0 6px; font-size: 20px; color: #303133; }
.desc { margin: 0; color: #909399; font-size: 13px; line-height: 1.6; }
.toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.count { color: #909399; font-size: 13px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  min-height: 160px;
}
.mentor-card { border: 1px solid #ebeef5; }
.mentor-card.selected { border-color: #67c23a; background: #f6ffed; }
.mentor-card :deep(.el-card__body) { display: flex; align-items: center; gap: 14px; }
.avatar {
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #2a7ae0;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.info { flex: 1; min-width: 0; }
.name { font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.meta { font-size: 12px; color: #909399; line-height: 1.7; }
.footer-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #ebeef5;
}
.tip { color: #c0c4cc; font-size: 12px; }
@media (max-width: 600px) {
  .header-row { flex-direction: column; align-items: flex-start; }
  .mentor-card :deep(.el-card__body) { flex-wrap: wrap; }
}
</style>
