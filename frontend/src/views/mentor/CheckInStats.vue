<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true">
        <el-form-item label="班级">
          <el-select v-model="filter.classId" clearable placeholder="全部" style="width: 140px" @change="load">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="专业">
          <el-select v-model="filter.majorId" clearable placeholder="全部" style="width: 140px" @change="load">
            <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="goBatchRemind" :disabled="stats.missing === 0">
            <el-icon><Bell /></el-icon>
            批量提醒未打卡({{ stats.missing }})
          </el-button>
          <el-button @click="exportExcel">
            <el-icon><Download /></el-icon>
            导出 Excel
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">总人数</div>
          <div class="stat-value">{{ stats.totalStudents }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">本周已打卡</div>
          <div class="stat-value success">{{ stats.checkedIn }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">本周未打卡</div>
          <div class="stat-value danger">{{ stats.missing }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">连续打卡</div>
          <div class="stat-value">{{ stats.streakCount }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="kygl-card">
      <template #header><span class="card-title">近 12 周打卡率趋势</span></template>
      <v-chart v-if="trendOption" :option="trendOption" class="chart" autoresize />
      <el-empty v-else />
    </el-card>

    <el-card class="kygl-card">
      <template #header><span class="card-title">本周未打卡学生</span></template>
      <el-table :data="missing" stripe>
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="username" label="学号" width="120" />
        <el-table-column prop="class.name" label="班级" width="140" />
        <el-table-column prop="major.name" label="专业" width="140" />
        <el-table-column prop="phone" label="手机号" />
      </el-table>
      <el-empty v-if="missing.length === 0" description="本周全员已完成打卡 ✓" />
    </el-card>

    <!-- 批量提醒对话框 -->
    <el-dialog v-model="notifyDialog" title="批量发送提醒" width="500px">
      <el-form :model="notifyForm" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="notifyForm.title" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="notifyForm.content" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="notifyDialog = false">取消</el-button>
        <el-button type="primary" :loading="notifyLoading" @click="sendNotify">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { CheckInApi, MentorApi, AdminApi, ReportsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';

use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const auth = useAuthStore();
const stats = ref<any>({ trend: [], totalStudents: 0, checkedIn: 0, missing: 0, streakCount: 0, rate: 0 });
const missing = ref<any[]>([]);
const classes = ref<any[]>([]);
const majors = ref<any[]>([]);
const filter = reactive({ classId: undefined as number | undefined, majorId: undefined as number | undefined });
const notifyDialog = ref(false);
const notifyLoading = ref(false);
const notifyForm = reactive({ title: '【打卡提醒】本周考研打卡未完成', content: '同学你好,本周考研进度打卡尚未完成,请尽快登录系统完成打卡。' });

const trendOption = computed(() => {
  const trend = stats.value.trend || [];
  if (!trend.length) return null;
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['按时', '逾期补', '未打卡'], bottom: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: trend.map((t: any) => t.weekKey) },
    yAxis: { type: 'value', name: '人数' },
    series: [
      { name: '按时', type: 'bar', stack: 'a', data: trend.map((t: any) => t.onTime), itemStyle: { color: '#67c23a' } },
      { name: '逾期补', type: 'bar', stack: 'a', data: trend.map((t: any) => t.late), itemStyle: { color: '#e6a23c' } },
      { name: '未打卡', type: 'bar', stack: 'a', data: trend.map((t: any) => t.missing), itemStyle: { color: '#f56c6c' } },
    ],
  };
});

async function load() {
  try {
    const [s, m] = await Promise.all([
      CheckInApi.mentorStats(filter),
      CheckInApi.mentorMissing(filter),
    ]);
    stats.value = s;
    missing.value = m;
  } catch {
    /* 已提示 */
  }
}

function goBatchRemind() {
  notifyDialog.value = true;
}

async function sendNotify() {
  const ids = missing.value.map((s) => s.id);
  if (ids.length === 0) {
    ElMessage.warning('当前没有需要提醒的学生');
    return;
  }
  notifyLoading.value = true;
  try {
    const res: any = await MentorApi.batchNotify({ studentIds: ids, title: notifyForm.title, content: notifyForm.content });
    ElMessage.success(`提醒已发送给 ${res.sent} 名学生`);
    notifyDialog.value = false;
  } catch {
    /* 已提示 */
  } finally {
    notifyLoading.value = false;
  }
}

async function exportExcel() {
  try {
    const blob: any = await ReportsApi.exportCheckinExcel(filter);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `周度打卡统计.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* 已提示 */
  }
}

async function loadScope() {
  if (auth.role !== 'STUDENT') {
    classes.value = (await AdminApi.listClasses()) as any;
    majors.value = (await AdminApi.listMajors()) as any;
  }
}

onMounted(() => {
  loadScope();
  load();
});
</script>

<style scoped>
.stat-card { text-align: center; margin-bottom: 16px; min-height: 100px; }
.stat-label { color: #909399; font-size: 13px; }
.stat-value { font-size: 26px; font-weight: 600; }
.stat-value.success { color: var(--kygl-success); }
.stat-value.danger { color: var(--kygl-danger); }
.card-title { font-weight: 600; }
.chart { height: 280px; }
.kygl-card { margin-bottom: 16px; }
</style>
