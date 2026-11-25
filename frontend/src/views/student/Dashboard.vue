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
      <div v-if="deadlineTip" class="deadline-tip">
        <el-icon><AlarmClock /></el-icon>
        <span>{{ deadlineTip }}</span>
      </div>
    </el-card>

    <!-- 我的导师 / 选导师引导 -->
    <el-card v-if="!mentorLoading" class="kygl-card mentor-card" :class="{ 'mentor-missing': !myMentor }">
      <div class="mentor-row">
        <div class="mentor-info">
          <template v-if="myMentor">
            <div class="mentor-avatar"><el-icon :size="22"><User /></el-icon></div>
            <div>
              <div class="mentor-label">我的指导老师</div>
              <div class="mentor-name">{{ myMentor.name }} <span class="mentor-no">({{ myMentor.staffNo }})</span></div>
            </div>
          </template>
          <template v-else>
            <div class="mentor-avatar warn"><el-icon :size="22"><Warning /></el-icon></div>
            <div>
              <div class="mentor-label">还未选择指导老师</div>
              <div class="mentor-name hint">选择导师后，导师就能看到你的进度并给予指导</div>
            </div>
          </template>
        </div>
        <el-button :type="myMentor ? 'default' : 'primary'" @click="$router.push('/student/mentor-select')">
          {{ myMentor ? '更换导师' : '立即选择' }}
        </el-button>
      </div>
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
      <el-empty v-else description="暂无打卡数据，完成本周打卡后开始记录" :image-size="70" />
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
import { CheckInApi, ProgressApi, MentorSelectionApi } from '@/api';
import { stageLabel, stageTagType } from '@/utils/stage';

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const auth = useAuthStore();
const profile = ref<any>({});
const weekStatus = ref<any>({});
const history = ref<any>({ streak: 0, calendar: [] });
const archive = ref<any>({});
const keyNodes = ref<any[]>([]);
const myMentor = ref<any>(null);
const mentorLoading = ref(false);

// 本周打卡截止倒计时文案
const deadlineTip = computed(() => {
  const end = weekStatus.value?.weekEnd;
  const submitted = !!weekStatus.value?.currentRecord;
  if (!end || submitted) return '';
  const diff = dayjs(end).diff(dayjs(), 'minute');
  if (diff <= 0) return '本周打卡已截止';
  const days = Math.floor(diff / 1440);
  const hours = Math.floor((diff % 1440) / 60);
  return days > 0 ? `距本周打卡截止还有 ${days} 天 ${hours} 小时` : `距本周打卡截止还有 ${hours} 小时`;
});

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
  // 导师状态单独加载,失败不影响看板其它内容
  mentorLoading.value = true;
  try {
    myMentor.value = await MentorSelectionApi.myMentor();
  } catch {
    myMentor.value = null;
  } finally {
    mentorLoading.value = false;
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
.deadline-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #e6a23c;
  font-size: 13px;
}
.mentor-card { border-left: 3px solid #409eff; }
.mentor-card.mentor-missing { border-left-color: #e6a23c; background: #fffdf6; }
.mentor-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mentor-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mentor-avatar {
  width: 42px; height: 42px; flex: 0 0 42px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: #e8f3ff; color: #409eff;
}
.mentor-avatar.warn { background: #fdf6ec; color: #e6a23c; }
.mentor-label { font-size: 12px; color: #909399; margin-bottom: 3px; }
.mentor-name { font-size: 16px; font-weight: 600; color: #303133; }
.mentor-name.hint { font-size: 13px; font-weight: 400; color: #606266; }
.mentor-no { font-size: 12px; font-weight: 400; color: #909399; }
</style>
