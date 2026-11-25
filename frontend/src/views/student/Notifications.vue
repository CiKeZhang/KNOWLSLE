<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header>
        <div class="flex-between">
          <span class="card-title">我的消息</span>
          <el-button
            v-if="unreadTotal > 0"
            type="primary"
            plain
            size="small"
            :loading="markingAll"
            @click="markAllRead"
          >
            全部标为已读 ({{ unreadTotal }})
          </el-button>
        </div>
      </template>
      <el-skeleton :loading="loading" animated :rows="4" v-if="loading" />
      <template v-else>
        <div v-if="list.length > 0" class="notice-list">
          <div
            v-for="n in list"
            :key="n.id"
            class="notice-item"
            :class="{ unread: !isRead(n.id) }"
            @click="openNotice(n)"
          >
            <span class="notice-dot" v-if="!isRead(n.id)" />
            <div class="notice-body">
              <div class="notice-head">
                <strong>{{ n.title }}</strong>
                <span class="notice-time">{{ formatDate(n.createdAt) }}</span>
              </div>
              <p class="notice-content">{{ n.content }}</p>
              <span v-if="!isRead(n.id)" class="notice-mark">点击标为已读</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="测试期暂无消息，有新通知会第一时间显示在这里" />
        <el-pagination
          v-if="total > pageSize"
          class="mt-16"
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="load"
        />
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import dayjs from 'dayjs';
import { NotificationsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import {
  isNoticeRead,
  markNoticeRead,
  markAllNoticesRead,
  onNoticeReadChanged,
} from '@/utils/noticeRead';

const auth = useAuthStore();
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const markingAll = ref(false);
// 触发视图重算:已读状态来自 localStorage,改动后靠此计数器驱动刷新
const readTick = ref(0);

const unreadTotal = computed(() => {
  void readTick.value;
  return list.value.filter((n: any) => !isNoticeRead(auth.user?.id ?? 0, Number(n.id))).length;
});

function isRead(id: number) {
  void readTick.value;
  return isNoticeRead(auth.user?.id ?? 0, Number(id));
}

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}

async function load() {
  loading.value = true;
  try {
    const res: any = await NotificationsApi.inbox({ page: page.value, pageSize });
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

function openNotice(n: any) {
  if (!isRead(Number(n.id))) {
    markNoticeRead(auth.user?.id ?? 0, Number(n.id));
    readTick.value++;
  }
}

async function markAllRead() {
  if (!list.value.length) return;
  markingAll.value = true;
  try {
    markAllNoticesRead(auth.user?.id ?? 0, list.value.map((n) => Number(n.id)));
    readTick.value++;
  } finally {
    markingAll.value = false;
  }
}

let off: (() => void) | undefined;
onMounted(() => {
  load();
  off = onNoticeReadChanged(() => { readTick.value++; });
});
onUnmounted(() => off?.());
</script>

<style scoped>
.card-title { font-weight: 600; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mt-16 { margin-top: 16px; }
.notice-list { display: flex; flex-direction: column; }
.notice-item {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 14px 12px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}
.notice-item:hover { background: #f5f7fa; }
.notice-item.unread { background: #f0f7ff; }
.notice-dot {
  position: absolute;
  left: 2px;
  top: 20px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #409eff;
}
.notice-body { flex: 1; min-width: 0; }
.notice-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.notice-head strong { font-size: 14px; color: #303133; }
.notice-time { font-size: 12px; color: #909399; white-space: nowrap; }
.notice-content { color: #606266; font-size: 13px; margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; }
.notice-mark { display: inline-block; margin-top: 6px; font-size: 11px; color: #409eff; }
</style>
