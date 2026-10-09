<template>
  <div class="kygl-page">
    <!-- 状态卡片 -->
    <el-card class="kygl-card">
      <div class="checkin-header">
        <div>
          <h2>本周打卡 ({{ weekStatus.weekKey }})</h2>
          <p class="muted">{{ formatRange(weekStatus.weekStart, weekStatus.weekEnd) }}</p>
        </div>
        <div class="checkin-state">
          <el-tag v-if="weekStatus.currentRecord" :type="statusTagType(weekStatus.currentRecord.status)" size="large">
            {{ statusLabel(weekStatus.currentRecord.status) }} · 已完成
          </el-tag>
          <el-tag v-else-if="weekStatus.inWindow" type="success" size="large">未打卡 · 窗口开放</el-tag>
          <el-tag v-else-if="weekStatus.canMakeup" type="warning" size="large">逾期 · 可申请补卡</el-tag>
          <el-tag v-else type="danger" size="large">逾期 · 补卡截止</el-tag>
        </div>
      </div>
    </el-card>

    <!-- 打卡表单 -->
    <el-card class="kygl-card" v-if="!weekStatus.currentRecord || editing">
      <template #header>
        <span class="card-title">{{ editing ? '修改本周打卡' : '提交本周打卡' }}</span>
      </template>
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" size="large">
        <el-divider content-position="left">必填项</el-divider>

        <!-- 1. 当前核心流程节点 -->
        <el-form-item label="当前核心流程节点" prop="stage">
          <el-radio-group v-model="form.stage">
            <el-radio
              v-for="s in STAGE_LIST"
              :key="s.value"
              :value="s.value"
              border
            >{{ s.label }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 2. 本周核心完成事项 -->
        <el-form-item label="本周核心完成事项(勾选)" prop="completedItems">
          <el-checkbox-group v-model="form.completedItems">
            <el-checkbox
              v-for="item in completeItemOptions"
              :key="item"
              :value="item"
              :label="item"
              border
              class="check-item"
            >{{ item }}</el-checkbox>
          </el-checkbox-group>
          <el-input
            v-model="customItem"
            placeholder="其他事项(回车添加)"
            class="mt-8"
            @keyup.enter="addCustomItem"
          >
            <template #append>
              <el-button @click="addCustomItem">添加</el-button>
            </template>
          </el-input>
        </el-form-item>

        <!-- 3. 本周遇到的主要备考困难 -->
        <el-form-item label="本周遇到的主要备考困难" prop="difficulties">
          <el-input
            v-model="form.difficulties"
            type="textarea"
            :rows="4"
            placeholder="请如实填写本周遇到的备考困难,辅导员/导师会据此提供帮扶..."
            maxlength="500"
            show-word-limit
          />
          <div class="mt-8">
            <el-button size="small" type="primary" plain @click="openHelpFromDifficulties">
              <el-icon><Connection /></el-icon>
              将该困难一键转化为帮扶申请
            </el-button>
          </div>
        </el-form-item>

        <el-divider content-position="left">选填项</el-divider>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="本周学习总时长(小时)">
              <el-input-number v-model="form.studyHours" :min="0" :max="168" :step="0.5" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="目标院校/专业是否调整">
              <el-switch v-model="form.targetSchoolChanged" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="8">
            <el-form-item label="公共课进度(%)">
              <el-slider v-model="form.progressPublic" :max="100" show-input />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="专业课进度(%)">
              <el-slider v-model="form.progressMajor" :max="100" show-input />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="模考分数(选填)">
              <el-button @click="mockDialogVisible = true" plain>
                {{ form.mockScore ? '已填写,点击修改' : '点击填写模考分数' }}
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
            提交本周打卡
          </el-button>
          <el-button v-if="editing" size="large" @click="cancelEdit">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 已提交记录展示 -->
    <el-card v-else class="kygl-card">
      <template #header>
        <div class="flex-between">
          <span class="card-title">本周打卡详情</span>
          <el-button type="primary" plain @click="startEdit">修改</el-button>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="当前阶段">
          <el-tag :type="stageTagType(weekStatus.currentRecord.stage)" size="small">
            {{ stageLabel(weekStatus.currentRecord.stage) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="打卡状态">
          <el-tag :type="statusTagType(weekStatus.currentRecord.status)" size="small">
            {{ statusLabel(weekStatus.currentRecord.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="本周完成事项" :span="2">
          <el-tag v-for="i in (weekStatus.currentRecord.completedItems || [])" :key="i" class="mr-8" size="small">{{ i }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="本周困难" :span="2">
          {{ weekStatus.currentRecord.difficulties || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="学习时长">{{ Number(weekStatus.currentRecord.studyHours) || '—' }} 小时</el-descriptions-item>
        <el-descriptions-item label="公共课进度">{{ weekStatus.currentRecord.progressPublic ?? '—' }}%</el-descriptions-item>
        <el-descriptions-item label="专业课进度">{{ weekStatus.currentRecord.progressMajor ?? '—' }}%</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatDate(weekStatus.currentRecord.submittedAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 补卡申请 -->
    <el-card v-if="weekStatus.canMakeup && !weekStatus.currentRecord" class="kygl-card">
      <template #header><span class="card-title">补卡申请</span></template>
      <el-alert
        title="本周打卡已逾期。可在补卡有效期内申请补卡,经辅导员审核通过后视为补卡成功。"
        type="warning"
        :closable="false"
        class="mb-16"
      />
      <el-form :model="makeupForm" label-position="top">
        <el-form-item label="补卡原因">
          <el-input v-model="makeupForm.reason" type="textarea" :rows="3" placeholder="请说明未按时打卡的原因..." maxlength="300" show-word-limit />
        </el-form-item>
        <el-button type="warning" :loading="makeupLoading" @click="submitMakeup">提交补卡申请</el-button>
      </el-form>
    </el-card>

    <!-- 历史曲线 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">近 12 周打卡记录</span></template>
      <v-chart v-if="historyOption" :option="historyOption" class="chart" autoresize />
      <el-empty v-else description="暂无历史打卡数据" />
    </el-card>

    <!-- 模考分数对话框 -->
    <el-dialog v-model="mockDialogVisible" title="填写模考分数" width="480px">
      <el-form :model="form.mockScore" label-width="100px">
        <el-form-item label="政治"><el-input-number v-model="form.mockScore.politics" :min="0" :max="100" /></el-form-item>
        <el-form-item label="英语"><el-input-number v-model="form.mockScore.english" :min="0" :max="100" /></el-form-item>
        <el-form-item label="数学"><el-input-number v-model="form.mockScore.math" :min="0" :max="150" /></el-form-item>
        <el-form-item label="专业课"><el-input-number v-model="form.mockScore.major" :min="0" :max="150" /></el-form-item>
      </el-form>
    </el-dialog>

    <!-- 一键转帮扶对话框 -->
    <el-dialog v-model="helpDialogVisible" title="将困难转化为帮扶申请" width="500px">
      <el-form :model="helpForm" label-position="top">
        <el-form-item label="帮扶类型">
          <el-select v-model="helpForm.type" style="width: 100%">
            <el-option v-for="t in HELP_TYPE_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="帮扶内容(预填打卡困难)">
          <el-input v-model="helpForm.content" type="textarea" :rows="4" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="helpDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHelpFromDifficulties">提交帮扶申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage, type FormInstance } from 'element-plus';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { CheckInApi, HelpApi } from '@/api';
import {
  STAGE_LIST, stageLabel, stageTagType,
  HELP_TYPE_LIST,
  checkinStatusLabel as statusLabel,
  checkinStatusTagType as statusTagType,
} from '@/utils/stage';

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const formRef = ref<FormInstance>();
const submitting = ref(false);
const makeupLoading = ref(false);
const editing = ref(false);
const mockDialogVisible = ref(false);
const helpDialogVisible = ref(false);
const customItem = ref('');

const weekStatus = ref<any>({});
const history = ref<any>({ calendar: [], streak: 0 });

const form = reactive<any>({
  stage: '',
  completedItems: [],
  difficulties: '',
  studyHours: undefined,
  progressPublic: 0,
  progressMajor: 0,
  targetSchoolChanged: false,
  mockScore: {} as Record<string, number>,
});

const rules = {
  stage: [{ required: true, message: '请选择当前阶段', trigger: 'change' }],
  completedItems: [{ required: true, type: 'array', min: 1, message: '请勾选本周完成事项', trigger: 'change' }],
  difficulties: [{ required: true, message: '请填写本周困难', trigger: 'blur' }],
};

const makeupForm = reactive({ reason: '' });
const helpForm = reactive({ type: 'OTHER', content: '' });

const completeItemOptions = [
  '完成本周公共课知识点学习',
  '完成本周专业课知识点学习',
  '完成本周真题练习',
  '完成本周模考',
  '完成本周错题整理',
  '与导师/学长学姐沟通',
  '调整了目标院校/专业',
  '参与了模拟面试',
];

const historyOption = computed(() => {
  const cal = [...(history.value?.calendar ?? [])].reverse();
  if (cal.length === 0) return null;
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['按时', '逾期补', '未打卡'] },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: cal.map((c: any) => c.weekKey) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '按时',
        type: 'bar',
        stack: 'a',
        data: cal.map((c: any) => (c.status === 'ON_TIME' ? 1 : 0)),
        itemStyle: { color: '#67c23a' },
      },
      {
        name: '逾期补',
        type: 'bar',
        stack: 'a',
        data: cal.map((c: any) => (c.status === 'LATE' ? 1 : 0)),
        itemStyle: { color: '#e6a23c' },
      },
      {
        name: '未打卡',
        type: 'bar',
        stack: 'a',
        data: cal.map((c: any) => (c.status === 'MISSING' || !c.status ? 1 : 0)),
        itemStyle: { color: '#f56c6c' },
      },
    ],
  };
});

function addCustomItem() {
  const v = customItem.value.trim();
  if (v && !form.completedItems.includes(v)) {
    form.completedItems.push(v);
    customItem.value = '';
  }
}

function startEdit() {
  const r = weekStatus.value.currentRecord;
  form.stage = r.stage;
  form.completedItems = r.completedItems || [];
  form.difficulties = r.difficulties || '';
  form.studyHours = Number(r.studyHours) || undefined;
  form.progressPublic = r.progressPublic ?? 0;
  form.progressMajor = r.progressMajor ?? 0;
  form.targetSchoolChanged = r.targetSchoolChanged ?? false;
  form.mockScore = r.mockScore || {};
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

function formatRange(s: string, e: string) {
  if (!s) return '';
  return `${dayjs(s).format('MM-DD HH:mm')} 至 ${dayjs(e).format('MM-DD HH:mm')}`;
}
function formatDate(d: string) {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '—';
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (ok) => {
    if (!ok) return;
    submitting.value = true;
    const payload = {
      stage: form.stage,
      completedItems: form.completedItems,
      difficulties: form.difficulties,
      studyHours: form.studyHours,
      progressPublic: form.progressPublic,
      progressMajor: form.progressMajor,
      targetSchoolChanged: form.targetSchoolChanged,
      mockScore: Object.keys(form.mockScore).length ? form.mockScore : undefined,
    };
    try {
      await CheckInApi.submit(payload);
      ElMessage.success('本周打卡已提交');
      clearPendingCheckIn();
      editing.value = false;
      await load();
    } catch {
      // 网络波动时本地缓存,恢复后自动同步
      cachePendingCheckIn(payload);
      ElMessage.warning('网络异常,打卡数据已本地缓存,恢复网络后将自动同步');
    } finally {
      submitting.value = false;
    }
  });
}

// ============ 离线缓存与自动同步 ============
const PENDING_KEY = 'kygl_pending_checkin';

function cachePendingCheckIn(payload: any) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      payload,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    /* localStorage 不可用时静默 */
  }
}

function clearPendingCheckIn() {
  localStorage.removeItem(PENDING_KEY);
}

function getPendingCheckIn(): { payload: any; cachedAt: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function syncPendingCheckIn() {
  const pending = getPendingCheckIn();
  if (!pending) return;
  try {
    await CheckInApi.submit(pending.payload);
    clearPendingCheckIn();
    ElMessage.success('已自动同步缓存的打卡数据');
    await load();
  } catch {
    /* 仍然失败,保留缓存等待下次重试 */
  }
}

// 监听网络恢复事件
window.addEventListener('online', () => {
  syncPendingCheckIn();
});

// 页面加载时检查是否有待同步的缓存
function checkPendingOnLoad() {
  const pending = getPendingCheckIn();
  if (pending && navigator.onLine) {
    syncPendingCheckIn();
  } else if (pending) {
    ElMessage.info('检测到未同步的打卡数据,网络恢复后将自动提交');
  }
}

async function submitMakeup() {
  if (!makeupForm.reason.trim()) {
    ElMessage.warning('请填写补卡原因');
    return;
  }
  makeupLoading.value = true;
  try {
    await CheckInApi.applyMakeup({
      weekStart: dayjs(weekStatus.value.weekStart).format('YYYY-MM-DDTHH:mm:ss'),
      reason: makeupForm.reason,
    });
    ElMessage.success('补卡申请已提交,请等待辅导员审批');
    makeupForm.reason = '';
    await load();
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    makeupLoading.value = false;
  }
}

function openHelpFromDifficulties() {
  helpForm.content = form.difficulties;
  helpDialogVisible.value = true;
}

async function submitHelpFromDifficulties() {
  if (!helpForm.content.trim()) {
    ElMessage.warning('帮扶内容不能为空');
    return;
  }
  try {
    await HelpApi.apply({ type: helpForm.type, content: helpForm.content });
    ElMessage.success('帮扶申请已提交,导师将尽快对接');
    helpDialogVisible.value = false;
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function load() {
  try {
    const [ws, hist] = await Promise.all([
      CheckInApi.myWeekStatus(),
      CheckInApi.myHistory(),
    ]);
    weekStatus.value = ws;
    history.value = hist;
  } catch {
    /* 错误已由拦截器提示 */
  }
}

onMounted(() => {
  checkPendingOnLoad();
  load();
});
</script>

<style scoped>
.checkin-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.checkin-header h2 { margin: 0 0 8px; font-size: 18px; }
.muted { color: #909399; margin: 0; font-size: 13px; }
.card-title { font-weight: 600; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.check-item { margin: 4px; }
.mt-8 { margin-top: 8px; }
.mb-16 { margin-bottom: 16px; }
.mr-8 { margin-right: 8px; }
.chart { height: 280px; }
</style>
