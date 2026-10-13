<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">个人考研档案</span></template>
      <el-tabs v-model="activeTab">
        <!-- 基本信息与目标院校 -->
        <el-tab-pane label="基本信息" name="archive">
          <el-form :model="archiveForm" label-position="top">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12">
                <el-form-item label="目标院校">
                  <el-input v-model="archiveForm.targetSchoolName" placeholder="可暂存目标院校" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="目标专业">
                  <el-input v-model="archiveForm.targetMajor" placeholder="可暂存目标专业" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="公共课进度">
                  <el-slider v-model="archiveForm.publicCourseProgress" :max="100" show-input />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="专业课进度">
                  <el-slider v-model="archiveForm.majorCourseProgress" :max="100" show-input />
                </el-form-item>
              </el-col>
            </el-row>
            <el-divider>初试成绩(出分后填写)</el-divider>
            <el-row :gutter="16">
              <el-col :xs="12" :sm="6">
                <el-form-item label="总分"><el-input-number v-model="archiveForm.examTotal" :min="0" :max="500" style="width: 100%" /></el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="政治"><el-input-number v-model="archiveForm.examPolitics" :min="0" :max="100" style="width: 100%" /></el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="英语"><el-input-number v-model="archiveForm.examEnglish" :min="0" :max="100" style="width: 100%" /></el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="数学"><el-input-number v-model="archiveForm.examMath" :min="0" :max="150" style="width: 100%" /></el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="专业课"><el-input-number v-model="archiveForm.examMajor" :min="0" :max="150" style="width: 100%" /></el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="复试进度%">
                  <el-slider v-model="archiveForm.reexamProgress" :max="100" show-input />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="调剂进展">
              <el-input v-model="archiveForm.adjustmentProgress" type="textarea" :rows="2" />
            </el-form-item>
            <el-button type="primary" :loading="saving" @click="saveArchive">保存档案</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 个人背景(AI 推荐输入) -->
        <el-tab-pane label="个人背景(AI推荐输入)" name="profile">
          <el-alert type="info" :closable="false" title="此信息将作为 AI 择校推荐的核心输入维度,请如实填写" class="mb-16" />
          <el-form :model="profileForm" label-position="top">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12">
                <el-form-item label="本科专业"><el-input v-model="profileForm.undergraduateMajor" /></el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="绩点"><el-input-number v-model="profileForm.gpa" :precision="2" :step="0.1" :min="0" :max="5" style="width: 100%" /></el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="专业排名(如 5/60)"><el-input v-model="profileForm.majorRank" placeholder="5/60" /></el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="意向地区"><el-input v-model="profileForm.region" placeholder="北京/上海..." /></el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="院校层次偏好">
                  <el-select v-model="profileForm.schoolTierPref" style="width: 100%" clearable>
                    <el-option v-for="t in SCHOOL_TIER_LIST" :key="t.value" :label="t.label" :value="t.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="备考剩余时长(月)"><el-input-number v-model="profileForm.remainingMonths" :min="0" :max="24" style="width: 100%" /></el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="优势科目(回车添加)">
              <el-input v-model="strongInput" @keyup.enter="addStrong" placeholder="政治、英语...">
                <template #append><el-button @click="addStrong">添加</el-button></template>
              </el-input>
              <el-tag v-for="(s, i) in profileForm.strongSubjects" :key="i" closable @close="profileForm.strongSubjects.splice(i, 1)" class="mr-8 mt-8">{{ s }}</el-tag>
            </el-form-item>
            <el-form-item label="弱势科目">
              <el-input v-model="weakInput" @keyup.enter="addWeak" placeholder="数学三、专业课...">
                <template #append><el-button @click="addWeak">添加</el-button></template>
              </el-input>
              <el-tag v-for="(s, i) in profileForm.weakSubjects" :key="i" closable @close="profileForm.weakSubjects.splice(i, 1)" class="mr-8 mt-8" type="danger">{{ s }}</el-tag>
            </el-form-item>
            <el-form-item label="未来就业意向"><el-input v-model="profileForm.careerIntention" /></el-form-item>
            <el-button type="primary" :loading="saving" @click="saveProfile">保存背景信息</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 进度时间线 -->
        <el-tab-pane label="进度时间线" name="timeline">
          <el-timeline v-if="timeline.length > 0">
            <el-timeline-item v-for="(item, i) in timeline" :key="i" :timestamp="formatDate(item.at)" placement="top" :type="item.type === 'stage_change' ? 'primary' : 'success'">
              <strong>{{ stageLabel(item.stage) }}</strong>
              <p v-if="item.type === 'checkin'" class="muted small">
                周度打卡 · {{ item.studyHours ? '学习 ' + item.studyHours + ' 小时' : '' }}
              </p>
              <p v-if="item.type === 'checkin' && item.difficulties" class="muted small">
                困难:{{ item.difficulties }}
              </p>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无进度轨迹,完成本周打卡后将自动记录" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { ProgressApi } from '@/api';
import { STAGE_LIST, SCHOOL_TIER_LIST, stageLabel } from '@/utils/stage';

const activeTab = ref('archive');
const saving = ref(false);
const strongInput = ref('');
const weakInput = ref('');
const timeline = ref<any[]>([]);

const archiveForm = reactive<any>({
  targetSchoolName: '',
  targetMajor: '',
  publicCourseProgress: 0,
  majorCourseProgress: 0,
  examTotal: undefined,
  examPolitics: undefined,
  examEnglish: undefined,
  examMath: undefined,
  examMajor: undefined,
  reexamProgress: undefined,
  adjustmentProgress: '',
});

const profileForm = reactive<any>({
  undergraduateMajor: '',
  gpa: undefined,
  majorRank: '',
  region: '',
  schoolTierPref: '',
  strongSubjects: [],
  weakSubjects: [],
  careerIntention: '',
  remainingMonths: undefined,
});

function addStrong() {
  if (strongInput.value && !profileForm.strongSubjects.includes(strongInput.value)) {
    profileForm.strongSubjects.push(strongInput.value);
    strongInput.value = '';
  }
}
function addWeak() {
  if (weakInput.value && !profileForm.weakSubjects.includes(weakInput.value)) {
    profileForm.weakSubjects.push(weakInput.value);
    weakInput.value = '';
  }
}

function formatDate(d: string) {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '';
}

async function load() {
  try {
    const res: any = await ProgressApi.myArchive();
    const arch = res.archive || {};
    const prof = res.profile || {};
    Object.assign(archiveForm, {
      targetSchoolName: arch.targetSchoolName ?? '',
      targetMajor: arch.targetMajor ?? '',
      publicCourseProgress: Number(arch.publicCourseProgress) || 0,
      majorCourseProgress: Number(arch.majorCourseProgress) || 0,
      examTotal: arch.examTotal ?? undefined,
      examPolitics: arch.examPolitics ?? undefined,
      examEnglish: arch.examEnglish ?? undefined,
      examMath: arch.examMath ?? undefined,
      examMajor: arch.examMajor ?? undefined,
      reexamProgress: arch.reexamProgress != null ? Number(arch.reexamProgress) : undefined,
      adjustmentProgress: arch.adjustmentProgress ?? '',
    });
    Object.assign(profileForm, {
      undergraduateMajor: prof.undergraduateMajor ?? '',
      gpa: prof.gpa != null ? Number(prof.gpa) : undefined,
      majorRank: prof.majorRank ?? '',
      region: prof.region ?? '',
      schoolTierPref: prof.schoolTierPref ?? '',
      strongSubjects: prof.strongSubjects ?? [],
      weakSubjects: prof.weakSubjects ?? [],
      careerIntention: prof.careerIntention ?? '',
      remainingMonths: prof.remainingMonths ?? undefined,
    });
    timeline.value = res.timeline ?? [];
  } catch {
    /* 已提示 */
  }
}

async function saveArchive() {
  saving.value = true;
  try {
    await ProgressApi.updateArchive(archiveForm);
    ElMessage.success('档案已保存');
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

async function saveProfile() {
  saving.value = true;
  try {
    await ProgressApi.updateProfile(profileForm);
    ElMessage.success('背景信息已保存');
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.card-title { font-weight: 600; }
.muted { color: #909399; margin: 0; }
.small { font-size: 13px; }
.mr-8 { margin-right: 8px; }
.mt-8 { margin-top: 8px; }
.mb-16 { margin-bottom: 16px; }
</style>
