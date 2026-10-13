<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true">
        <el-form-item label="状态">
          <el-select v-model="filter.status" clearable placeholder="全部" style="width: 120px" @change="load">
            <el-option label="待处理" value="OPEN" />
            <el-option label="已处理" value="HANDLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filter.type" clearable placeholder="全部" style="width: 200px" @change="load">
            <el-option v-for="(v, k) in ALERT_TYPE_MAP" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <el-table :data="list" stripe>
        <el-table-column label="学生" width="120">
          <template #default="{ row }">{{ row.student?.name }}</template>
        </el-table-column>
        <el-table-column label="班级" width="140">
          <template #default="{ row }">{{ row.student?.class?.name }}</template>
        </el-table-column>
        <el-table-column label="预警类型" width="200">
          <template #default="{ row }">
            <el-tag :type="alertTagType(row.type)" size="small">{{ alertTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'OPEN' ? 'danger' : 'success'" size="small">
              {{ row.status === 'OPEN' ? '待处理' : '已处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'OPEN'" size="small" type="primary" @click="handle(row)">标记已处理</el-button>
            <el-button size="small" link @click="goDetail(row)">查看学生</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="list.length === 0" description="暂无预警" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { MentorApi } from '@/api';
import { ALERT_TYPE_MAP, alertTypeLabel } from '@/utils/stage';

const router = useRouter();
const list = ref<any[]>([]);
const filter = reactive({ status: '', type: '' });

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}

function alertTagType(t: string): any {
  return t?.includes('CHECKIN') ? 'danger' : t?.includes('PROGRESS') ? 'warning' : 'info';
}

async function load() {
  try {
    list.value = (await MentorApi.alerts(filter)) as any;
  } catch {
    /* 已提示 */
  }
}

async function handle(row: any) {
  try {
    await MentorApi.handleAlert(row.id);
    ElMessage.success('已标记为处理');
    await load();
  } catch {
    /* 已提示 */
  }
}

function goDetail(row: any) {
  router.push(`/mentor/students/${row.studentId}`);
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
</style>
