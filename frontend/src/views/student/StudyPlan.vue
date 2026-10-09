<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">智能备考计划</span>
          <div>
            <el-radio-group v-model="period" size="small" @change="load">
              <el-radio-button value="weekly">本周计划</el-radio-button>
              <el-radio-button value="monthly">本月计划</el-radio-button>
            </el-radio-group>
            <el-button size="small" type="primary" plain :loading="regenerating" @click="regenerate" class="ml-8">
              <el-icon><Refresh /></el-icon> 基于当前阶段重新生成
            </el-button>
          </div>
        </div>
      </template>

      <el-alert v-if="plan?.notes" type="info" :closable="false" class="mb-16">
        <template #title>
          <span>当前阶段:<strong>{{ stageLabel(plan.stage) }}</strong></span>
        </template>
        {{ plan.notes }}
      </el-alert>

      <div v-loading="loading">
        <el-table :data="tasks" stripe>
          <el-table-column label="" width="60">
            <template #default="{ row, $index }">
              <el-checkbox v-model="row.done" @change="toggle($index, row.done)" />
            </template>
          </el-table-column>
          <el-table-column label="任务" min-width="300">
            <template #default="{ row, $index }">
              <el-input
                v-model="row.task"
                :readonly="!editing"
                :class="{ 'task-done': row.done }"
                size="default"
              />
              <span class="task-index">#{{ $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="科目" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="subjectTagType(row.subject)">{{ row.subject || '—' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="目标时长" width="120">
            <template #default="{ row }">
              <span v-if="!editing">{{ row.targetHours || 0 }} 小时</span>
              <el-input-number v-else v-model="row.targetHours" :min="0" :max="100" size="small" controls-position="right" style="width: 100px" />
            </template>
          </el-table-column>
        </el-table>

        <div class="plan-stats">
          <el-statistic title="总任务数" :value="tasks.length" />
          <el-statistic title="已完成" :value="doneCount" />
          <el-statistic title="完成率" :value="completionRate" suffix="%" />
          <el-statistic title="本周总时长" :value="totalHours" suffix="小时" />
        </div>

        <div class="plan-actions">
          <el-button v-if="!editing" type="primary" @click="editing = true">
            <el-icon><EditPen /></el-icon> 手动调整计划
          </el-button>
          <template v-else>
            <el-button type="success" :loading="saving" @click="addTask">
              <el-icon><Plus /></el-icon> 新增任务
            </el-button>
            <el-button type="primary" :loading="saving" @click="save">保存调整</el-button>
            <el-button @click="cancelEdit">取消</el-button>
          </template>
        </div>
      </div>
    </el-card>

    <!-- 进度复盘 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">学习进度复盘</span></template>
      <el-progress :percentage="completionRate" :stroke-width="20" :text-inside="true" status="success" />
      <p class="muted mt-16">
        <el-icon><InfoFilled /></el-icon>
        坚持每周完成计划任务,系统会自动记录你的完成率,帮助你养成备考自我复盘习惯。完成率将体现在你的考研档案中。
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { StudyPlanApi } from '@/api';
import { stageLabel } from '@/utils/stage';

const period = ref<'weekly' | 'monthly'>('weekly');
const plan = ref<any>(null);
const tasks = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const regenerating = ref(false);
const editing = ref(false);
const snapshot = ref<any[]>([]);

const doneCount = computed(() => tasks.value.filter((t) => t.done).length);
const completionRate = computed(() =>
  tasks.value.length === 0 ? 0 : Math.round((doneCount.value / tasks.value.length) * 100),
);
const totalHours = computed(() =>
  tasks.value.reduce((sum, t) => sum + (Number(t.targetHours) || 0), 0),
);

function subjectTagType(s: string) {
  const m: Record<string, string> = {
    英语: 'success',
    政治: 'warning',
    数学: 'danger',
    专业课: '',
    综合: 'info',
  };
  return m[s] ?? 'info';
}

async function load() {
  loading.value = true;
  editing.value = false;
  try {
    plan.value = period.value === 'weekly'
      ? await StudyPlanApi.weekly()
      : await StudyPlanApi.monthly();
    tasks.value = JSON.parse(JSON.stringify(plan.value.tasks || []));
    snapshot.value = JSON.parse(JSON.stringify(tasks.value));
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function toggle(index: number, done: boolean) {
  try {
    await StudyPlanApi.toggle(plan.value.id, { index, done });
    if (done) ElMessage.success('任务已标记完成');
  } catch {
    tasks.value[index].done = !done;
  }
}

function addTask() {
  tasks.value.push({ task: '', subject: '综合', targetHours: 4, done: false });
}

function cancelEdit() {
  tasks.value = JSON.parse(JSON.stringify(snapshot.value));
  editing.value = false;
}

async function save() {
  saving.value = true;
  try {
    await StudyPlanApi.update(plan.value.id, { tasks: tasks.value, notes: plan.value.notes });
    ElMessage.success('计划已调整保存');
    editing.value = false;
    snapshot.value = JSON.parse(JSON.stringify(tasks.value));
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

async function regenerate() {
  regenerating.value = true;
  try {
    plan.value = await StudyPlanApi.regenerate();
    tasks.value = JSON.parse(JSON.stringify(plan.value.tasks || []));
    snapshot.value = JSON.parse(JSON.stringify(tasks.value));
    ElMessage.success('已根据当前阶段重新生成本周计划');
  } catch {
    /* 已提示 */
  } finally {
    regenerating.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-weight: 600; }
.mb-16 { margin-bottom: 16px; }
.ml-8 { margin-left: 8px; }
.mt-16 { margin-top: 16px; }
.muted { color: #909399; display: flex; align-items: center; gap: 4px; }
.task-index { color: #c0c4cc; font-size: 11px; margin-left: 4px; }
.task-done :deep(.el-input__inner) { text-decoration: line-through; color: #909399; }
.plan-stats {
  display: flex;
  gap: 32px;
  margin: 24px 0;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}
.plan-actions { display: flex; gap: 8px; }
</style>
