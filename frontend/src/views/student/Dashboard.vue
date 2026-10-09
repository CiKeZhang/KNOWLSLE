<template>
  <div class="kygl-page">
    <!-- 顶部:欢迎与当前阶段 -->
    <el-card class="kygl-card">
      <div class="welcome">
        <div>
          <h2>{{ auth.user?.name }},欢迎回来</h2>
          <p class="muted">
            当前阶段:
            <el-tag :type="stageTagType(profile.currentStage)" size="small">
              {{ stageLabel(profile.currentStage) }}
            </el-tag>
          </p>
        </div>
        <div class="week-checkin">
          <el-button type="primary" size="large" @click="$router.push('/student/checkin')">
            <el-icon><EditPen /></el-icon>
            {{ weekStatus.currentRecord ? '查看本周打卡' : '去本周打卡' }}
          </el-button>
        </div>
      </div>
      <el-alert
        v-if="weekStatus.inWindow && !weekStatus.currentRecord"
        title="本周打卡窗口已开放,请尽快完成"
        type="success"
        :closable="false"
        class="mt-16"
      />
      <el-alert
        v-else-if="weekStatus.pastDeadline && !weekStatus.currentRecord && weekStatus.canMakeup"
        title="本周打卡已逾期,可申请补卡"
        type="warning"
        :closable="false"
        class="mt-16"
      />
    </el-card>

    <!-- 关键节点提醒 -->
    <el-card class="kygl-card" v-if="keyNodes.length > 0">
      <template #header>
        <span class="card-title">考研关键节点</span>
      </template>
      <el-timeline>
        <el-timeline-item
          v-for="node in keyNodes.slice(0, 6)"
          :key="node.id"
          :timestamp="formatDate(node.remindAt)"
          placement="top"
          :type="isApproaching(node.remindAt) ? 'warning' : 'primary'"
        >
          <strong>{{ node.name }}</strong>
          <p v-if="node.description" class="muted small">{{ node.description }}</p>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- 我的进度概览 -->
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-label">连续打卡</div>
          <div class="stat-value">{{ history.streak }} 周</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-label">公共课进度</div>
          <el-progress :percentage="archive.publicCourseProgress ?? 0" :stroke-width="10" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-label">专业课进度</div>
          <el-progress :percentage="archive.majorCourseProgress ?? 0" :stroke-width="10" status="success" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-label">目标院校</div>
          <div class="stat-value small">{{ archive.targetSchoolName || '暂未设置' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 近期打卡曲线 -->
    <el-card class="kygl-card mt-16">
      <template #header><span class="card-title">近 12 周打卡曲线</span></template>
      <v-chart v-if="chartOption" :option="chartOption" class="chart" autoresize />
      <el-empty v-else description="暂无打卡数据" />
    </el-card>

    <!-- 快捷入口 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">快捷入口</span></template>
      <el-row :gutter="16">
        <el-col :xs="12" :sm="6" v-for="item in shortcuts" :key="item.path">
          <div class="shortcut" @click="$router.push(item.path)">
            <el-icon :size="28" :color="item.color"><component :is="item.icon" /></el-icon>
            <p>{{ item.title }}</p>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useAuthStore } from '@/stores/auth';
import { CheckInApi, ProgressApi } from '@/api';
import { stageLabel, stageTagType } from '@/utils/stage';

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const auth = useAuthStore();
const profile = ref<any>({});
const weekStatus = ref<any>({});
const history = ref<any>({ streak: 0, calendar: [] });
const archive = ref<any>({});
const keyNodes = ref<any[]>([]]);

const shortcuts = [
  { path: '/student/checkin', title: '本周打卡', icon: 'EditPen', color: '#2a7ae0' },
  { path: '/student/ai', title: 'AI 择校', icon: 'MagicStick', color: '#67c23a' },
  { path: '/student/archive', title: '我的档案', icon: 'Document', color: '#e6a23c' },
  { path: '/student/help', title: '学业帮扶', icon: 'ChatLineRound', color: '#f56c6c' },
];

const chartOption = computed(() => {
  if (!history.value?.calendar?.length) return null;
  const cal = [...history.value.calendar].reverse();
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['学习时长'] },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: cal.map((c: any) => c.weekKey) },
    yAxis: { type: 'value', name: '小时' },
    series: [
      {
        name: '学习时长',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.2 },
        data: cal.map((c: any) => Number(c.studyHours) || 0),
        itemStyle: { color: '#2a7ae0' },
      },
    ],
  };
});

function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}
function isApproaching(d: string) {
  const days = dayjs(d).diff(dayjs(), 'day');
  return days >= 0 && days <= 14;
}

async function load() {
  try {
    const [ws, hist, arch, kns] = await Promise.all([
      CheckInApi.myWeekStatus(),
      CheckInApi.myHistory(),
      ProgressApi.myArchive(),
      ProgressApi.keyNodes(),
    ]);
    weekStatus.value = ws;
    history.value = hist;
    archive.value = (arch as any)?.archive ?? {};
    profile.value = (arch as any)?.profile ?? {};
    keyNodes.value = kns as any;
  } catch {
    /* 错误已由拦截器提示 */
  }
}

onMounted(load);
</script>

<style scoped>
.welcome { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.welcome h2 { margin: 0 0 8px; font-size: 20px; }
.muted { color: #909399; margin: 0; }
.small { font-size: 14px; }
.mt-16 { margin-top: 16px; }
.card-title { font-weight: 600; }
.stat-card { text-align: center; margin-bottom: 16px; min-height: 110px; }
.stat-label { color: #909399; font-size: 13px; margin-bottom: 8px; }
.stat-value { font-size: 24px; font-weight: 600; color: #303133; }
.chart { height: 280px; }
.shortcut {
  text-align: center;
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.shortcut:hover { background: #f5f7fa; }
.shortcut p { margin: 8px 0 0; font-size: 13px; color: #606266; }
</style>
