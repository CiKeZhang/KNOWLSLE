<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">待审核资源</span></template>
      <el-table :data="pendingList" stripe>
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ resourceTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="上传者" width="120">
          <template #default="{ row }">{{ row.uploader?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="success" @click="review(row, 'APPROVED')">通过</el-button>
            <el-button size="small" type="danger" @click="review(row, 'REJECTED')">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="pendingList.length === 0" description="暂无待审核资源" />
    </el-card>

    <el-card class="kygl-card">
      <template #header><span class="card-title">全部资源</span></template>
      <el-form :inline="true">
        <el-form-item label="类型">
          <el-select v-model="filter.type" clearable placeholder="全部" style="width: 140px" @change="loadAll">
            <el-option v-for="t in RESOURCE_TYPE_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="success" @click="addDialog = true"><el-icon><Plus /></el-icon> 上传资源</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="allList" stripe>
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column label="类型" width="120"><template #default="{ row }">{{ resourceTypeLabel(row.type) }}</template></el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="viewCount" label="浏览数" width="80" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'OFFLINE'" size="small" type="warning" link @click="offline(row)">下架</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addDialog" title="上传资源" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="类型" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="t in RESOURCE_TYPE_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="链接"><el-input v-model="form.url" placeholder="外链 URL" /></el-form-item>
        <el-form-item label="适用阶段">
          <el-select v-model="form.stage" clearable style="width: 100%">
            <el-option v-for="s in STAGE_LIST" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用专业"><el-input v-model="form.majorName" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submit">提交(待审核)</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { ResourcesApi } from '@/api';
import {
  RESOURCE_TYPE_LIST, resourceTypeLabel,
  STAGE_LIST, stageLabel,
} from '@/utils/stage';

const pendingList = ref<any[]>([]);
const allList = ref<any[]>([]);
const addDialog = ref(false);
const loading = ref(false);
const filter = reactive({ type: '' });
const form = reactive<any>({ type: 'PUBLIC_COURSE', title: '', description: '', url: '', stage: '', majorName: '' });

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}
function statusLabel(s: string) {
  return { PENDING_REVIEW: '待审核', APPROVED: '已通过', REJECTED: '已驳回', OFFLINE: '已下架' }[s] ?? s;
}
function statusType(s: string): any {
  return { PENDING_REVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger', OFFLINE: 'info' }[s] ?? 'info';
}

async function loadPending() {
  try {
    pendingList.value = (await ResourcesApi.pendingReview()) as any;
  } catch {
    /* 已提示 */
  }
}

async function loadAll() {
  try {
    const res: any = await ResourcesApi.list({ ...filter, pageSize: 100 });
    allList.value = res.items || [];
  } catch {
    /* 已提示 */
  }
}

async function review(row: any, status: string) {
  try {
    await ResourcesApi.review(row.id, status);
    ElMessage.success('已处理');
    await loadPending();
    await loadAll();
  } catch {
    /* 已提示 */
  }
}

async function offline(row: any) {
  try {
    await ResourcesApi.offline(row.id);
    ElMessage.success('已下架');
    await loadAll();
  } catch {
    /* 已提示 */
  }
}

async function submit() {
  if (!form.title) {
    ElMessage.warning('请填写标题');
    return;
  }
  loading.value = true;
  try {
    await ResourcesApi.create(form);
    ElMessage.success('已提交,待审核通过后学生可见');
    addDialog.value = false;
    form.title = form.description = form.url = '';
    await loadAll();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadPending();
  loadAll();
});
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
</style>
