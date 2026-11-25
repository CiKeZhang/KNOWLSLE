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
        <el-card
          class="stat-card clickable"
          :class="{ active: listTab === 'checked' }"
          role="button"
          tabindex="0"
          aria-label="查看本周已打卡学生列表"
          @click="showList('checked')"
          @keyup.enter="showList('checked')"
        >
          <div class="stat-label">本周已打卡 <span class="stat-hint">点击查看名单</span></div>
          <div class="stat-value success">{{ stats.checkedIn }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card
          class="stat-card clickable"
          :class="{ active: listTab === 'missing' }"
          role="button"
          tabindex="0"
          aria-label="查看本周未打卡学生列表"
          @click="showList('missing')"
          @keyup.enter="showList('missing')"
        >
          <div class="stat-label">本周未打卡 <span class="stat-hint">点击查看名单</span></div>
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
      <el-empty v-else description="测试期暂无趋势数据，积累打卡记录后自动生成" :image-size="70" />
    </el-card>

    <div ref="listSection">
      <el-card class="kygl-card">
        <el-tabs v-model="listTab" class="checkin-list-tabs">
          <el-tab-pane label="本周未打卡学生" name="missing">
            <el-table :data="missing" stripe>
              <el-table-column prop="name" label="姓名" width="100" />
              <el-table-column prop="username" label="学号" width="120" />
              <el-table-column prop="class.name" label="班级" width="140" />
              <el-table-column prop="major.name" label="专业" width="140" />
              <el-table-column prop="phone" label="手机号" />
            </el-table>
            <el-empty v-if="missing.length === 0" description="本周暂无未打卡学生（尚无打卡记录时也会显示为空）" :image-size="70" />
          </el-tab-pane>
          <el-tab-pane label="本周已打卡学生" name="checked">
            <el-table :data="checkedIn" stripe>
              <el-table-column prop="name" label="姓名" width="100" />
              <el-table-column prop="username" label="学号" width="120" />
              <el-table-column prop="class.name" label="班级" width="140" />
              <el-table-column prop="major.name" label="专业" width="140" />
              <el-table-column label="打卡状态" width="110">
                <template #default="{ row }">
                  <el-tag v-if="row.thisWeekCheckin === 'ON_TIME'" type="success" size="small" effect="light">按时打卡</el-tag>
                  <el-tag v-else-if="row.thisWeekCheckin === 'LATE'" type="warning" size="small" effect="light">逾期补卡</el-tag>
                  <span v-else>—</span>
                </template>
              </el-table-column>
              <el-table-column prop="phone" label="手机号" />
            </el-table>
            <el-empty v-if="checkedIn.length === 0" description="本周暂无已打卡学生" :image-size="70" />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>

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
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
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
const checkedIn = ref<any[]>([]);
const listTab = ref<'missing' | 'checked'>('missing');
const listSection = ref<HTMLElement | null>(null);
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

async function loadStudents() {
  const first: any = await MentorApi.students({ ...filter, page: 1, pageSize: 100 });
  const all: any[] = [...(first.items || [])];
  const total = first.total ?? all.length;
  for (let page = 2; all.length < total && page <= 20; page++) {
    const more: any = await MentorApi.students({ ...filter, page, pageSize: 100 });
    if (!more.items?.length) break;
    all.push(...more.items);
  }
  return all;
}

async function load() {
  try {
    const [s, students]: any[] = await Promise.all([
      CheckInApi.mentorStats(filter),
      loadStudents(),
    ]);
    stats.value = s;
    checkedIn.value = students.filter((item: any) =>
      ['ON_TIME', 'LATE'].includes(item.thisWeekCheckin),
    );
    missing.value = students.filter(
      (item: any) => !['ON_TIME', 'LATE'].includes(item.thisWeekCheckin),
    );
  } catch {
    /* 已提示 */
  }
}

function showList(tab: 'missing' | 'checked') {
  listTab.value = tab;
  nextTick(() => listSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
.stat-card.clickable { cursor: pointer; transition: box-shadow .2s, border-color .2s, transform .2s; }
.stat-card.clickable:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0, 0, 0, .08); }
.stat-card.clickable.active { border-color: var(--kygl-primary, #409eff); box-shadow: 0 0 0 1px var(--kygl-primary, #409eff) inset; }
.stat-card.clickable:focus-visible { outline: 2px solid var(--kygl-primary, #409eff); outline-offset: 2px; }
.stat-label { color: #909399; font-size: 13px; }
.stat-hint { display: block; margin-top: 2px; font-size: 11px; color: #c0c4cc; }
.stat-card.clickable:hover .stat-hint { color: var(--kygl-primary, #409eff); }
.stat-value { font-size: 26px; font-weight: 600; }
.stat-value.success { color: var(--kygl-success); }
.stat-value.danger { color: var(--kygl-danger); }
.card-title { font-weight: 600; }
.chart { height: 280px; }
.kygl-card { margin-bottom: 16px; }
.checkin-list-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }
@media (max-width: 600px) {
  .stat-card { min-height: 88px; }
  .stat-hint { font-size: 10px; }
}
</style>
