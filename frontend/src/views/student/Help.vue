<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">学业帮扶申请</span></template>
      <el-form :model="form" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="帮扶类型">
              <el-select v-model="form.type" style="width: 100%">
                <el-option v-for="t in HELP_TYPE_LIST" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="期望对接角色">
              <el-select v-model="form.preferredRole" clearable placeholder="不限" style="width: 100%">
                <el-option label="辅导员" value="COUNSELOR" />
                <el-option label="专业导师" value="MAJOR_MENTOR" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="帮扶内容描述">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请详细描述你遇到的困难,以便导师提供针对性帮扶..." maxlength="500" show-word-limit />
        </el-form-item>
        <el-button type="primary" :loading="loading" @click="submit">提交帮扶申请</el-button>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <template #header><span class="card-title">我的帮扶申请</span></template>
      <el-timeline v-if="list.length > 0">
        <el-timeline-item v-for="app in list" :key="app.id" :timestamp="formatDate(app.createdAt)" placement="top" :type="statusType(app.status)">
          <div class="app-card">
            <div class="app-head">
              <strong>{{ helpTypeLabel(app.type) }}</strong>
              <el-tag :type="statusType(app.status)" size="small">{{ statusLabel(app.status) }}</el-tag>
            </div>
            <p class="muted">{{ app.content }}</p>
            <div v-if="app.assignee" class="assignee">
              对接人:{{ app.assignee.name }} ({{ roleLabel(app.assignee.role) }})
            </div>
            <el-collapse v-if="app.records?.length > 0" class="mt-8">
              <el-collapse-item title="帮扶记录" :name="app.id">
                <div v-for="rec in app.records" :key="rec.id" class="record-item">
                  <p><strong>{{ rec.mentor.name }}</strong>:{{ rec.content }}</p>
                  <p v-if="rec.effect" class="muted small">效果:{{ rec.effect }}</p>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无帮扶申请,遇到困难可随时提交" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { HelpApi } from '@/api';
import { HELP_TYPE_LIST, helpTypeLabel } from '@/utils/stage';

const loading = ref(false);
const list = ref<any[]>([]);
const form = reactive({ type: 'OTHER', content: '', preferredRole: '' });

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}
function statusLabel(s: string) {
  return { OPEN: '待处理', ASSIGNED: '已分配', IN_PROGRESS: '帮扶中', RESOLVED: '已解决', CLOSED: '已关闭' }[s] ?? s;
}
function statusType(s: string): any {
  return { OPEN: 'warning', ASSIGNED: 'info', IN_PROGRESS: 'primary', RESOLVED: 'success', CLOSED: 'info' }[s] ?? 'info';
}
function roleLabel(r: string) {
  return { COUNSELOR: '辅导员', MAJOR_MENTOR: '专业导师', ACADEMIC_ADMIN: '教学管理员' }[r] ?? r;
}

async function submit() {
  if (!form.content.trim()) {
    ElMessage.warning('请填写帮扶内容');
    return;
  }
  loading.value = true;
  try {
    await HelpApi.apply(form);
    ElMessage.success('帮扶申请已提交,导师将尽快对接');
    form.content = '';
    await load();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function load() {
  try {
    list.value = (await HelpApi.myApplications()) as any;
  } catch {
    /* 已提示 */
  }
}

onMounted(load);
</script>

<style scoped>
.card-title { font-weight: 600; }
.app-card { padding: 8px 0; }
.app-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.muted { color: #909399; margin: 4px 0; }
.small { font-size: 13px; }
.assignee { color: var(--kygl-primary); font-size: 13px; margin-top: 4px; }
.mt-8 { margin-top: 8px; }
.record-item { padding: 8px 0; border-bottom: 1px dashed #ebeef5; }
.record-item:last-child { border-bottom: none; }
</style>
