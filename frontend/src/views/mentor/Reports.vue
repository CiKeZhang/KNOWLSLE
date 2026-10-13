<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">学院考研工作报表</span></template>
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
        <el-form-item label="学期">
          <el-input v-model="filter.semester" placeholder="2026-S1" style="width: 140px" />
        </el-form-item>
        <el-form-item label="月份">
          <el-input v-model="filter.month" placeholder="2026-09" style="width: 120px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">查询</el-button>
          <el-button @click="exportExcel"><el-icon><Download /></el-icon> 导出 Excel</el-button>
          <el-button @click="exportPdf"><el-icon><Download /></el-icon> 导出 PDF</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16" v-if="summary">
      <el-col :xs="12" :sm="6"><el-card class="stat-card"><div class="stat-label">学生总数</div><div class="stat-value">{{ summary.totalStudents }}</div></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card class="stat-card"><div class="stat-label">初试通过率</div><div class="stat-value">{{ summary.examPassedRate }}%</div></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card class="stat-card"><div class="stat-label">上岸率</div><div class="stat-value">{{ summary.admittedRate }}%</div></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card class="stat-card"><div class="stat-label">打卡完成率</div><div class="stat-value">{{ summary.checkin.checkinRate }}%</div></el-card></el-col>
    </el-row>

    <el-card class="kygl-card" v-if="analysis">
      <template #header><span class="card-title">月度打卡趋势</span></template>
      <v-chart v-if="trendOption" :option="trendOption" class="chart" autoresize />
      <el-empty v-else />
    </el-card>

    <el-card class="kygl-card" v-if="summary">
      <template #header><span class="card-title">阶段分布明细</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item v-for="(v, k) in summary.stageDistribution" :key="k" :label="stageLabel(k)">{{ v }} 人</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ReportsApi, AdminApi } from '@/api';
import { stageLabel } from '@/utils/stage';

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const summary = ref<any>(null);
const analysis = ref<any>(null);
const classes = ref<any[]>([]);
const majors = ref<any[]>([]);
const filter = reactive({ classId: undefined as number | undefined, majorId: undefined as number | undefined, semester: '', month: '' });

const trendOption = computed(() => {
  const t = analysis.value?.monthlyTrend || [];
  if (!t.length) return null;
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['按时', '逾期补', '未打卡'], bottom: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: t.map((m: any) => m.month) },
    yAxis: { type: 'value', name: '次数' },
    series: [
      { name: '按时', type: 'bar', stack: 'a', data: t.map((m: any) => m.onTime), itemStyle: { color: '#67c23a' } },
      { name: '逾期补', type: 'bar', stack: 'a', data: t.map((m: any) => m.late), itemStyle: { color: '#e6a23c' } },
      { name: '未打卡', type: 'bar', stack: 'a', data: t.map((m: any) => m.missing), itemStyle: { color: '#f56c6c' } },
    ],
  };
});

async function load() {
  try {
    const params = { ...filter };
    // 去空字符串
    Object.keys(params).forEach((k) => (params[k] === '' || params[k] === undefined) && delete params[k]);
    const [s, a] = await Promise.all([
      ReportsApi.summary(params),
      ReportsApi.checkinAnalysis(params),
    ]);
    summary.value = s;
    analysis.value = a;
  } catch {
    /* 已提示 */
  }
}

async function exportExcel() {
  try {
    const blob: any = await ReportsApi.exportCheckinExcel(filter);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '周度打卡统计.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* 已提示 */
  }
}

async function exportPdf() {
  try {
    const blob: any = await ReportsApi.exportProgressPdf(filter);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '考研进度汇总.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* 已提示 */
  }
}

async function loadScope() {
  classes.value = (await AdminApi.listClasses()) as any;
  majors.value = (await AdminApi.listMajors()) as any;
}

onMounted(() => {
  loadScope();
  load();
});
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
.stat-card { text-align: center; margin-bottom: 16px; min-height: 100px; }
.stat-label { color: #909399; font-size: 13px; }
.stat-value { font-size: 26px; font-weight: 600; color: var(--kygl-primary); }
.chart { height: 280px; }
</style>
