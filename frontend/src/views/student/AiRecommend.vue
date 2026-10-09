<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">AI 择校择专业助手</span></template>
      <el-alert
        type="info"
        :closable="false"
        title="基于专业相关性、历年录取数据、学生自身条件三大维度加权计算,提供冲刺/稳妥/保底分档推荐。"
        class="mb-16"
      />
      <el-form :model="form" label-position="top" size="large">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="本科专业"><el-input v-model="form.undergraduateMajor" placeholder="如:会计学" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="绩点"><el-input-number v-model="form.gpa" :precision="2" :step="0.1" :min="0" :max="5" style="width: 100%" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="专业排名(如 5/60)"><el-input v-model="form.majorRank" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="意向地区"><el-input v-model="form.region" placeholder="北京/上海..." /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="院校层次偏好">
              <el-select v-model="form.schoolTierPref" style="width: 100%" clearable>
                <el-option v-for="t in SCHOOL_TIER_LIST" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="备考剩余时长(月)"><el-input-number v-model="form.remainingMonths" :min="0" :max="24" style="width: 100%" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="目标专业(可选,缩小范围)"><el-input v-model="form.targetMajor" placeholder="会计学/金融学..." /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="未来就业意向"><el-input v-model="form.careerIntention" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="优势科目"><el-input v-model="strongInput" placeholder="用逗号分隔" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="弱势科目"><el-input v-model="weakInput" placeholder="用逗号分隔" /></el-form-item>
          </el-col>
        </el-row>
        <el-button type="primary" size="large" :loading="loading" @click="recommend">
          <el-icon><MagicStick /></el-icon> 生成择校方案
        </el-button>
      </el-form>
    </el-card>

    <!-- 推荐结果 -->
    <el-card v-if="result" class="kygl-card">
      <template #header><span class="card-title">推荐结果</span></template>
      <el-alert v-if="result.llmSummary" type="success" :closable="false" :title="'AI 综合建议'" class="mb-16">
        <template #default>
          <p style="white-space: pre-wrap; margin: 0">{{ result.llmSummary }}</p>
        </template>
      </el-alert>
      <el-alert v-else type="info" :closable="false" :title="result.summary" class="mb-16" />
      <el-tabs v-model="activeTier">
        <el-tab-pane v-for="tier in tiers" :key="tier" :label="`${tier} (${groupByTier[tier]?.length ?? 0})`" :name="tier">
          <el-row :gutter="16">
            <el-col v-for="item in (groupByTier[tier] || [])" :key="item.itemId" :xs="24" :sm="12" :md="8">
              <el-card class="recom-card" shadow="hover">
                <div class="recom-head">
                  <strong>{{ item.schoolName }}</strong>
                  <el-tag :type="tierTagType(item.tier)" size="small">{{ item.tier }}</el-tag>
                </div>
                <p class="muted">{{ item.majorName }}</p>
                <div class="recom-scores">
                  <el-statistic title="匹配度" :value="item.matchScore" suffix="/100" />
                  <el-statistic title="上岸概率" :value="item.probOfAdmission" suffix="%" />
                  <div>
                    <div class="stat-label">难度</div>
                    <el-tag :type="diffTagType(item.difficulty)" size="large">{{ item.difficulty }}</el-tag>
                  </div>
                </div>
                <el-divider />
                <div v-if="item.reasons?.length">
                  <strong>推荐理由:</strong>
                  <ul><li v-for="(r, i) in item.reasons" :key="i">{{ r }}</li></ul>
                </div>
                <div v-if="item.risks?.length" class="mt-8">
                  <strong style="color: var(--kygl-danger)">风险点:</strong>
                  <ul><li v-for="(r, i) in item.risks" :key="i" class="risk">{{ r }}</li></ul>
                </div>
                <div v-if="item.examSubjects?.length" class="mt-8">
                  <strong>考试科目:</strong>
                  <el-tag v-for="(s, i) in item.examSubjects" :key="i" size="small" class="mr-8 mt-8">{{ s }}</el-tag>
                </div>
                <div v-if="item.enrollCount || item.reexamLine" class="mt-8">
                  <span v-if="item.enrollCount" class="muted">招生 {{ item.enrollCount }} 人 · </span>
                  <span v-if="item.reexamLine" class="muted">复试线 {{ item.reexamLine }}</span>
                </div>
              </el-card>
            </el-col>
          </el-row>
          <el-empty v-if="!(groupByTier[tier]?.length)" description="该档暂无推荐项" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 历史推荐 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">历史推荐记录</span></template>
      <el-timeline v-if="recommendations.length > 0">
        <el-timeline-item v-for="rec in recommendations" :key="rec.id" :timestamp="formatDate(rec.createdAt)" placement="top">
          <strong>{{ rec.inputParams.undergraduateMajor }} - {{ rec.inputParams.targetMajor || '不限专业' }}</strong>
          <p class="muted small">共 {{ rec.result?.items?.length ?? 0 }} 项推荐 · {{ rec.llmSummary ? '含 AI 解释' : '仅规则结果' }}</p>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无历史推荐记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { AiApi, ProgressApi } from '@/api';
import { SCHOOL_TIER_LIST } from '@/utils/stage';

const loading = ref(false);
const result = ref<any>(null);
const recommendations = ref<any[]>([]);
const activeTier = ref('冲刺');
const strongInput = ref('');
const weakInput = ref('');

const form = reactive<any>({
  undergraduateMajor: '',
  gpa: undefined,
  majorRank: '',
  region: '',
  schoolTierPref: '',
  remainingMonths: undefined,
  strongSubjects: [],
  weakSubjects: [],
  careerIntention: '',
  targetMajor: '',
});

const tiers = ['冲刺', '稳妥', '保底'];

const groupByTier = computed(() => {
  const g: Record<string, any[]> = { 冲刺: [], 稳妥: [], 保底: [] };
  for (const item of result.value?.items ?? []) {
    if (g[item.tier]) g[item.tier].push(item);
  }
  return g;
});

function tierTagType(tier: string) {
  return tier === '冲刺' ? 'danger' : tier === '稳妥' ? 'warning' : 'success';
}
function diffTagType(d: string) {
  return d === '高' ? 'danger' : d === '中' ? 'warning' : 'success';
}
function formatDate(d: string) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}

async function recommend() {
  if (!form.undergraduateMajor.trim()) {
    ElMessage.warning('请填写本科专业');
    return;
  }
  if (strongInput.value) form.strongSubjects = strongInput.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (weakInput.value) form.weakSubjects = weakInput.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  loading.value = true;
  try {
    const res: any = await AiApi.recommend(form);
    result.value = res;
    ElMessage.success('推荐方案已生成');
    await loadHistory();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function loadHistory() {
  try {
    recommendations.value = (await AiApi.myRecommendations()) as any;
  } catch {
    /* 已提示 */
  }
}

async function loadProfile() {
  try {
    const res: any = await ProgressApi.myArchive();
    const prof = res.profile || {};
    form.undergraduateMajor = prof.undergraduateMajor ?? '';
    form.gpa = prof.gpa != null ? Number(prof.gpa) : undefined;
    form.majorRank = prof.majorRank ?? '';
    form.region = prof.region ?? '';
    form.schoolTierPref = prof.schoolTierPref ?? '';
    form.remainingMonths = prof.remainingMonths ?? undefined;
    form.strongSubjects = prof.strongSubjects ?? [];
    form.weakSubjects = prof.weakSubjects ?? [];
    form.careerIntention = prof.careerIntention ?? '';
    if (form.strongSubjects?.length) strongInput.value = form.strongSubjects.join(',');
    if (form.weakSubjects?.length) weakInput.value = form.weakSubjects.join(',');
  } catch {
    /* 已提示 */
  }
}

onMounted(() => {
  loadProfile();
  loadHistory();
});
</script>

<style scoped>
.card-title { font-weight: 600; }
.muted { color: #909399; margin: 4px 0; }
.small { font-size: 13px; }
.mr-8 { margin-right: 8px; }
.mt-8 { margin-top: 8px; }
.mb-16 { margin-bottom: 16px; }
.recom-card { margin-bottom: 16px; }
.recom-head { display: flex; justify-content: space-between; align-items: center; }
.recom-scores { display: flex; gap: 16px; align-items: flex-end; margin: 12px 0; }
.stat-label { color: #909399; font-size: 12px; margin-bottom: 4px; }
ul { margin: 4px 0; padding-left: 20px; }
li { margin: 4px 0; }
li.risk { color: var(--kygl-danger); }
</style>
