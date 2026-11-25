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
          <el-tooltip content="PDF 生成组件当前不可用,请先用 Excel 导出" placement="top">
            <span class="disabled-button-wrap">
              <el-button disabled><el-icon><Download /></el-icon> 导出 PDF（暂不可用）</el-button>
            </span>
          </el-tooltip>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16" v-if="summary">
      <el-col :xs="12" :sm="6"><el-card class="stat-card"><div class="stat-label">学生总数</div><div class="stat-value">{{ summary.totalStudents }}</div></el-card></el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">初试通过率</div>
          <div class="stat-value">{{ hasFinalResult ? summary.examPassedRate + '%' : '—' }}</div>
          <div v-if="!hasFinalResult" class="stat-hint">测试期暂无最终结果</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">上岸率</div>
          <div class="stat-value">{{ hasFinalResult ? summary.admittedRate + '%' : '—' }}</div>
          <div v-if="!hasFinalResult" class="stat-hint">测试期暂无最终结果</div>
        </el-card>
      </el-col>
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
        <el-descriptions-item v-for="(v, k) in summary.stageDistribution" :key="k" :label="stageLabel(String(k))">{{ v }} 人</el-descriptions-item>
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
// 通过率/上岸率依赖最终成绩(初试过线/录取结果),开测库没有这些数据,
// 后端会返回 0% —— 显示 0% 会被误读为「全员没过」,故用「—」并标注原因。
const hasFinalResult = computed(() => {
  const s = summary.value;
  if (!s) return false;
  const examPassed = Number(s.examPassed ?? 0);
  const admitted = Number(s.admitted ?? 0);
  return examPassed > 0 || admitted > 0;
});

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
    const params: Record<string, any> = { ...filter };
    // 去空字符串
    Object.keys(params).forEach((k) => {
      if (params[k] === '' || params[k] === undefined) delete params[k];
    });
    // 两个请求独立:checkin-analysis 仅管理员可用,导师/院长调用会 403。
    // 用 allSettled 避免它失败时把 summary 也一起拖垮,导致整个报表页空白。
    const [s, a] = await Promise.allSettled([
      ReportsApi.summary(params),
      ReportsApi.checkinAnalysis(params),
    ]);
    if (s.status === 'fulfilled') summary.value = s.value;
    // 403/失败时保留空趋势图,不影响通过率/上岸率等核心指标
    if (a.status === 'fulfilled') analysis.value = a.value;
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
.stat-hint { color: #c0c4cc; font-size: 11px; margin-top: 2px; }
.chart { height: 280px; }
.disabled-button-wrap { display: inline-block; cursor: not-allowed; }
</style>
