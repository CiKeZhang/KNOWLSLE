<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">我的消息</span></template>
      <el-timeline v-if="list.length > 0">
        <el-timeline-item v-for="n in list" :key="n.id" :timestamp="formatDate(n.createdAt)" placement="top">
          <strong>{{ n.title }}</strong>
          <p class="muted">{{ n.content }}</p>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无消息" />
      <el-pagination
        v-if="total > pageSize"
        class="mt-16"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="load"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import dayjs from 'dayjs';
import { NotificationsApi } from '@/api';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}

async function load() {
  try {
    const res: any = await NotificationsApi.inbox({ page: page.value, pageSize });
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  }
}

onMounted(load);
</script>

<style scoped>
.card-title { font-weight: 600; }
.muted { color: #909399; margin: 4px 0; }
.mt-16 { margin-top: 16px; }
</style>
