<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">补卡申请审批</span></template>
      <el-form :inline="true">
        <el-form-item label="状态">
          <el-select v-model="filter.status" clearable placeholder="全部" style="width: 140px" @change="load">
            <el-option label="待审批" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已驳回" value="REJECTED" />
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
        <el-table-column label="补卡周期" width="160">
          <template #default="{ row }">{{ formatDate(row.weekStart) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="补卡原因" min-width="240" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" size="small" type="success" @click="approve(row, true)">通过</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" type="danger" @click="approve(row, false)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="list.length === 0" description="暂无补卡申请" />
    </el-card>

    <el-dialog v-model="dialog" :title="approveResult.approve ? '通过补卡' : '驳回补卡'" width="500px">
      <el-form :model="approveResult" label-position="top">
        <el-form-item label="审批意见">
          <el-input v-model="approveResult.comment" type="textarea" :rows="3" placeholder="请填写审批意见..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button :type="approveResult.approve ? 'success' : 'danger'" :loading="loading" @click="submitApprove">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { CheckInApi } from '@/api';

const list = ref<any[]>([]);
const filter = reactive({ status: '' });
const dialog = ref(false);
const loading = ref(false);
const approveResult = reactive({ appId: 0, approve: false, comment: '' });

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD');
}
function statusLabel(s: string) {
  return { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回' }[s] ?? s;
}
function statusType(s: string): any {
  return { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[s] ?? 'info';
}

async function load() {
  try {
    list.value = (await CheckInApi.makeupApplications(filter)) as any;
  } catch {
    /* 已提示 */
  }
}

function approve(row: any, approve: boolean) {
  approveResult.appId = row.id;
  approveResult.approve = approve;
  approveResult.comment = '';
  dialog.value = true;
}

async function submitApprove() {
  loading.value = true;
  try {
    await CheckInApi.approveMakeup(approveResult.appId, {
      status: approveResult.approve ? 'APPROVED' : 'REJECTED',
      comment: approveResult.comment,
    });
    ElMessage.success('审批完成');
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
.card-title { font-weight: 600; }
</style>
