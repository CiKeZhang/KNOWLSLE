<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">数据库备份与恢复</span>
          <el-button type="primary" :loading="creating" @click="createBackup">
            <el-icon><Download /></el-icon> 立即备份
          </el-button>
        </div>
      </template>
      <el-alert type="info" :closable="false" class="mb-16">
        系统每日凌晨 2:00 自动备份数据库,保留最近 30 天。恢复操作会覆盖当前数据,请谨慎执行。
      </el-alert>
      <el-table :data="backups" stripe v-loading="loading">
        <el-table-column prop="filename" label="备份文件" min-width="280" />
        <el-table-column label="大小" width="120">
          <template #default="{ row }">{{ formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="备份时间" width="200">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" link :loading="restoring === row.filename" @click="restore(row)">
              恢复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && backups.length === 0" description="暂无备份记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AdminApi } from '@/api';

const backups = ref<any[]>([]);
const loading = ref(false);
const creating = ref(false);
const restoring = ref<string>('');

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm:ss');
}

async function load() {
  loading.value = true;
  try {
    backups.value = (await AdminApi.listBackups()) as any;
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function createBackup() {
  creating.value = true;
  try {
    const res: any = await AdminApi.createBackup();
    ElMessage.success(`备份成功:${res.filename} (${formatSize(res.size)})`);
    await load();
  } catch {
    /* 已提示 */
  } finally {
    creating.value = false;
  }
}

async function restore(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认从 ${row.filename} 恢复数据库?此操作将覆盖当前所有数据,且不可撤销!`,
      '危险操作确认',
      { type: 'error', confirmButtonText: '确认恢复', cancelButtonText: '取消' },
    );
    restoring.value = row.filename;
    await AdminApi.restoreBackup(row.filename);
    ElMessage.success('数据库恢复成功');
  } catch {
    /* 已提示或取消 */
  } finally {
    restoring.value = '';
  }
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-weight: 600; }
.mb-16 { margin-bottom: 16px; }
</style>
