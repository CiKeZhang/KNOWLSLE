<template>
  <div class="kygl-page">
    <!-- 顶部统计 -->
    <el-row :gutter="16">
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">考研总人数</div>
          <div class="stat-value">{{ dashboard.total }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">本周打卡率</div>
          <div class="stat-value">{{ dashboard.checkinRate }}%</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">初试通过率</div>
          <div class="stat-value">{{ dashboard.examPassRate }}%</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card">
          <div class="stat-label">上岸率</div>
          <div class="stat-value">{{ dashboard.admittedRate }}%</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选 -->
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
      </el-form>
    </el-card>

    <!-- 阶段分布饼图 -->
    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card class="kygl-card">
          <template #header><span class="card-title">阶段分布</span></template>
          <v-chart v-if="stageOption" :option="stageOption" class="chart" autoresize />
          <el-empty v-else />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card class="kygl-card">
          <template #header><span class="card-title">目标院校层次分布</span></template>
          <v-chart v-if="tierOption" :option="tierOption" class="chart" autoresize />
          <el-empty v-else />
        </el-card>
      </el-col>
    </el-row>

    <!-- 阶段变化趋势 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">近 12 周阶段变化趋势</span></template>
      <v-chart v-if="trendOption" :option="trendOption" class="chart-tall" autoresize />
      <el-empty v-else />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { PieChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useAuthStore } from '@/stores/auth';
import { MentorApi, AdminApi } from '@/api';
import { STAGE_LIST, stageLabel, tierLabel } from '@/utils/stage';

use([PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const auth = useAuthStore();
const dashboard = ref<any>({ stageDistribution: {}, tierDistribution: {}, stageTrend: [] });
const filter = reactive({ classId: undefined as number | undefined, majorId: undefined as number | undefined });
const classes = ref<any[]>([]);
const majors = ref<any[]>([]);

const stageOption = computed(() => {
  const data = Object.entries(dashboard.value.stageDistribution || {}).map(([k, v]) => ({
    name: stageLabel(k),
    value: v,
  }));
  if (!data.length) return null;
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{ type: 'pie', radius: ['40%', '70%'], data, label: { formatter: '{b}\n{d}%' } }],
  };
});

const tierOption = computed(() => {
  const data = Object.entries(dashboard.value.tierDistribution || {}).map(([k, v]) => ({
    name: tierLabel(k),
    value: v,
  }));
  if (!data.length) return null;
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{ type: 'pie', radius: '60%', data, label: { formatter: '{b}\n{d}%' } }],
  };
});

const trendOption = computed(() => {
  const trend = dashboard.value.stageTrend || [];
  if (!trend.length) return null;
  const weeks = trend.map((t: any) => t.weekKey);
  const stages = STAGE_LIST.map((s) => s.value);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: STAGE_LIST.map((s) => s.label), bottom: 0, type: 'scroll' },
    grid: { left: 40, right: 20, top: 30, bottom: 60 },
    xAxis: { type: 'category', data: weeks },
    yAxis: { type: 'value', name: '人数' },
    series: stages.map((s) => ({
      name: stageLabel(s),
      type: 'bar',
      stack: 'total',
      data: trend.map((t: any) => t.stages?.[s] ?? 0),
    })),
  };
});

async function load() {
  try {
    dashboard.value = await MentorApi.dashboard(filter);
  } catch {
    /* 已提示 */
  }
}

async function loadScope() {
  if (auth.role === 'COUNSELOR') {
    // 加载所带班级列表
  } else if (auth.role === 'MAJOR_MENTOR' || auth.isAcademicAdmin || auth.isSysAdmin) {
    majors.value = (await AdminApi.listMajors()) as any;
  }
  classes.value = (await AdminApi.listClasses()) as any;
}

onMounted(() => {
  loadScope();
  load();
});
</script>

<style scoped>
.stat-card { text-align: center; margin-bottom: 16px; min-height: 100px; }
.stat-label { color: #909399; font-size: 13px; margin-bottom: 4px; }
.stat-value { font-size: 26px; font-weight: 600; color: var(--kygl-primary); }
.card-title { font-weight: 600; }
.chart { height: 280px; }
.chart-tall { height: 320px; }
.kygl-card { margin-bottom: 16px; }
</style>
