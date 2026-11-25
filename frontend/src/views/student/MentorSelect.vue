<template>
  <div class="mentor-page">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div>
          <h2>我的指导老师</h2>
          <p class="desc">
            指导老师由学院按专业统一预分配，学生端不再支持自行选择或更换。如需调整，请联系教学管理员。
          </p>
        </div>
        <el-tag v-if="mentor" type="success" size="large" effect="light">已分配</el-tag>
        <el-tag v-else type="warning" size="large" effect="light">待分配</el-tag>
      </div>
    </el-card>

    <el-card v-loading="loading" shadow="never" class="detail-card">
      <template v-if="mentor">
        <div class="mentor-row">
          <div class="avatar">{{ mentor.name ? mentor.name.charAt(0) : '师' }}</div>
          <div class="info">
            <div class="name">{{ mentor.name }}</div>
            <div class="meta">工号：{{ mentor.staffNo || '—' }}</div>
          </div>
        </div>
        <el-alert
          class="tip"
          type="info"
          :closable="false"
          show-icon
          title="该分配结果用于导师查看你的进度与打卡记录，请与老师保持联系。"
        />
      </template>
      <el-empty v-else description="学院尚未分配指导老师，请联系教学管理员" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MentorSelectionApi } from '@/api';

interface MentorInfo {
  id: number;
  name: string;
  staffNo?: string | null;
}

const loading = ref(false);
const mentor = ref<MentorInfo | null>(null);

async function loadData() {
  loading.value = true;
  try {
    const mine: any = await MentorSelectionApi.myMentor();
    mentor.value = mine ?? null;
  } catch {
    mentor.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.mentor-page { max-width: 860px; margin: 0 auto; }
.header-card { margin-bottom: 16px; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.header-row h2 { margin: 0 0 6px; font-size: 20px; color: #303133; }
.desc { margin: 0; color: #909399; font-size: 13px; line-height: 1.6; }
.detail-card :deep(.el-card__body) { padding: 24px; }
.mentor-row { display: flex; align-items: center; gap: 16px; }
.avatar {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2a7ae0;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.name { font-size: 18px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.meta { font-size: 13px; color: #909399; }
.tip { margin-top: 20px; }
@media (max-width: 600px) {
  .header-row { flex-direction: column; align-items: flex-start; }
}
</style>
