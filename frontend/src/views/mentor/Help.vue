<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true">
        <el-form-item label="状态">
          <el-select v-model="filter.status" clearable placeholder="全部" style="width: 120px" @change="load">
            <el-option label="待处理" value="OPEN" />
            <el-option label="已分配" value="ASSIGNED" />
            <el-option label="帮扶中" value="IN_PROGRESS" />
            <el-option label="已解决" value="RESOLVED" />
            <el-option label="已关闭" value="CLOSED" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filter.type" clearable placeholder="全部" style="width: 140px" @change="load">
            <el-option v-for="t in HELP_TYPE_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <el-table :data="list" stripe>
        <el-table-column label="学生" width="120">
          <template #default="{ row }">{{ row.student?.name }}</template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ helpTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column prop="content" label="帮扶内容" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对接人" width="120">
          <template #default="{ row }">{{ row.assignee?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'OPEN'" size="small" type="primary" @click="assign(row)">接受对接</el-button>
            <el-button v-if="row.status === 'ASSIGNED'" size="small" type="success" @click="record(row)">记录帮扶</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="list.length === 0" description="暂无帮扶申请" />
    </el-card>

    <el-dialog v-model="dialog" title="记录帮扶内容" width="500px">
      <el-form :model="form" label-position="top">
        <el-form-item label="帮扶内容"><el-input v-model="form.content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="帮扶效果"><el-input v-model="form.effect" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submit">提交并标记已解决</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { MentorApi } from '@/api';
import { HELP_TYPE_LIST, helpTypeLabel } from '@/utils/stage';

const list = ref<any[]>([]);
const filter = reactive({ status: '', type: '' });
const dialog = ref(false);
const loading = ref(false);
const form = reactive({ content: '', effect: '', appId: 0 });

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}
function statusLabel(s: string) {
  return { OPEN: '待处理', ASSIGNED: '已分配', IN_PROGRESS: '帮扶中', RESOLVED: '已解决', CLOSED: '已关闭' }[s] ?? s;
}
function statusType(s: string): any {
  return { OPEN: 'danger', ASSIGNED: 'info', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'info' }[s] ?? 'info';
}

async function load() {
  try {
    list.value = (await MentorApi.helpApplications(filter)) as any;
  } catch {
    /* 已提示 */
  }
}

async function assign(row: any) {
  try {
    await MentorApi.assignHelp(row.id);
    ElMessage.success('已接受对接');
    await load();
  } catch {
    /* 已提示 */
  }
}

function record(row: any) {
  form.appId = row.id;
  form.content = '';
  form.effect = '';
  dialog.value = true;
}

async function submit() {
  if (!form.content.trim()) {
    ElMessage.warning('请填写帮扶内容');
    return;
  }
  loading.value = true;
  try {
    await MentorApi.recordHelp(form.appId, { content: form.content, effect: form.effect });
    ElMessage.success('帮扶记录已保存');
    dialog.value = false;
    await load();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
</style>
