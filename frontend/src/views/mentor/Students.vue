<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true" :model="filter">
        <el-form-item label="关键字">
          <el-input v-model="filter.keyword" clearable placeholder="姓名/学号" style="width: 160px" @keyup.enter="load" />
        </el-form-item>
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
        <el-form-item label="阶段">
          <el-select v-model="filter.stage" clearable placeholder="全部" style="width: 160px" @change="load">
            <el-option v-for="s in STAGE_LIST" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="打卡状态">
          <el-select v-model="filter.checkinStatus" clearable placeholder="全部" style="width: 120px" @change="load">
            <el-option label="已打卡" value="ON_TIME" />
            <el-option label="逾期补" value="LATE" />
            <el-option label="未打卡" value="MISSING" />
          </el-select>
        </el-form-item>
        <el-form-item label="分数段">
          <el-input-number v-model="filter.minScore" :min="0" :max="500" placeholder="min" style="width: 100px" />
          <span class="muted">-</span>
          <el-input-number v-model="filter.maxScore" :min="0" :max="500" placeholder="max" style="width: 100px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load"><el-icon><Search /></el-icon> 查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <el-table :data="list" stripe @row-click="goDetail">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="username" label="学号" width="120" />
        <el-table-column prop="class.name" label="班级" width="120" />
        <el-table-column prop="major.name" label="专业" width="120" />
        <el-table-column label="当前阶段" width="160">
          <template #default="{ row }">
            <el-tag :type="stageTagType(row.studentProfile?.currentStage)" size="small">
              {{ stageLabel(row.studentProfile?.currentStage) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="本周打卡" width="100">
          <template #default="{ row }">
            <el-tag :type="checkinStatusTagType(row.thisWeekCheckin)" size="small">
              {{ checkinStatusLabel(row.thisWeekCheckin) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标院校" min-width="140">
          <template #default="{ row }">
            {{ row.progressArchive?.targetSchoolName || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="公共课" width="100">
          <template #default="{ row }">
            <el-progress :percentage="Number(row.progressArchive?.publicCourseProgress) || 0" :stroke-width="6" :show-text="false" />
          </template>
        </el-table-column>
        <el-table-column label="专业课" width="100">
          <template #default="{ row }">
            <el-progress :percentage="Number(row.progressArchive?.majorCourseProgress) || 0" :stroke-width="6" status="success" :show-text="false" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="goDetail(row)">详情</el-button>
            <el-button size="small" type="warning" link @click.stop="watch(row)">关注</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-16"
        v-model:current-page="filter.page"
        :page-size="filter.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { MentorApi, AdminApi } from '@/api';
import {
  STAGE_LIST, stageLabel, stageTagType,
  checkinStatusLabel, checkinStatusTagType,
} from '@/utils/stage';

const router = useRouter();
const list = ref<any[]>([]);
const total = ref(0);
const classes = ref<any[]>([]);
const majors = ref<any[]>([]);
const filter = reactive({
  keyword: '', classId: undefined, majorId: undefined, stage: '',
  checkinStatus: '', minScore: undefined, maxScore: undefined,
  page: 1, pageSize: 20,
});

async function load() {
  try {
    const res: any = await MentorApi.students(filter);
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  }
}

function goDetail(row: any) {
  router.push(`/mentor/students/${row.id}`);
}

async function watch(row: any) {
  try {
    await MentorApi.watch(row.id);
    ElMessage.success(`已关注 ${row.name}`);
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
.card-title { font-weight: 600; }
.muted { color: #909399; margin: 0 4px; }
.mt-16 { margin-top: 16px; }
.kygl-card { margin-bottom: 16px; }
</style>
