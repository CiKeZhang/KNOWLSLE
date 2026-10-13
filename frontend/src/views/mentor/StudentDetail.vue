<template>
  <div class="kygl-page" v-if="student">
    <el-page-header @back="$router.back()" :content="`${student.student.name} 的考研档案`" />

    <el-row :gutter="16" class="mt-16">
      <el-col :xs="24" :md="8">
        <el-card class="kygl-card">
          <template #header><span class="card-title">基础信息</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="姓名">{{ student.student.name }}</el-descriptions-item>
            <el-descriptions-item label="学号">{{ student.student.username }}</el-descriptions-item>
            <el-descriptions-item label="班级">{{ student.student.class?.name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="专业">{{ student.student.major?.name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="当前阶段">
              <el-tag :type="stageTagType(student.student.studentProfile?.currentStage)" size="small">
                {{ stageLabel(student.student.studentProfile?.currentStage) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="目标院校">{{ student.student.progressArchive?.targetSchoolName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="目标专业">{{ student.student.progressArchive?.targetMajor || '—' }}</el-descriptions-item>
          </el-descriptions>
          <div class="actions mt-16">
            <el-button type="warning" size="small" @click="watch">{{ isWatched ? '取消关注' : '重点关注' }}</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="16">
        <el-card class="kygl-card">
          <template #header><span class="card-title">进度详情</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="公共课进度">
              <el-progress :percentage="Number(student.student.progressArchive?.publicCourseProgress) || 0" />
            </el-descriptions-item>
            <el-descriptions-item label="专业课进度">
              <el-progress :percentage="Number(student.student.progressArchive?.majorCourseProgress) || 0" status="success" />
            </el-descriptions-item>
            <el-descriptions-item label="初试总分">{{ student.student.progressArchive?.examTotal || '—' }}</el-descriptions-item>
            <el-descriptions-item label="复试进度">
              <el-progress v-if="student.student.progressArchive?.reexamProgress" :percentage="Number(student.student.progressArchive.reexamProgress)" />
              <span v-else>—</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="kygl-card">
      <template #header><span class="card-title">打卡轨迹</span></template>
      <el-timeline v-if="student.checkins?.length > 0">
        <el-timeline-item
          v-for="c in student.checkins"
          :key="c.id"
          :timestamp="formatDate(c.weekStart)"
          placement="top"
          :type="checkinStatusTagType(c.status)"
        >
          <div class="checkin-item">
            <el-tag :type="checkinStatusTagType(c.status)" size="small">{{ checkinStatusLabel(c.status) }}</el-tag>
            <el-tag v-if="c.stage" :type="stageTagType(c.stage)" size="small" class="ml-8">{{ stageLabel(c.stage) }}</el-tag>
            <span v-if="c.studyHours" class="muted ml-8">学习 {{ c.studyHours }} 小时</span>
          </div>
          <p v-if="c.difficulties" class="muted small mt-8">困难:{{ c.difficulties }}</p>
          <el-button v-if="c.difficulties" size="small" type="primary" link @click="offerHelp(c)">主动帮扶</el-button>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="该生暂无打卡记录" />
    </el-card>

    <el-card class="kygl-card">
      <template #header><span class="card-title">AI 择校方案(可校准)</span></template>
      <el-timeline v-if="student.recommendations?.length > 0">
        <el-timeline-item v-for="r in student.recommendations" :key="r.id" :timestamp="formatDate(r.createdAt)" placement="top">
          <div class="recom-head">
            <strong>{{ r.inputParams?.undergraduateMajor }} → {{ r.inputParams?.targetMajor || '不限' }}</strong>
            <el-button size="small" link @click="toggleRecom(r.id)">
              {{ expandedRecom[r.id] ? '收起' : `展开 ${r.result?.items?.length || 0} 项` }}
            </el-button>
          </div>
          <p v-if="r.llmSummary" class="muted small llm-summary">{{ r.llmSummary }}</p>
          <div v-if="expandedRecom[r.id]" class="recom-items">
            <el-table :data="r.result?.items || []" size="small" stripe>
              <el-table-column label="分档" width="80">
                <template #default="{ row }">
                  <el-tag :type="tierTagType(row.tier)" size="small">{{ row.tier }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="schoolName" label="院校" width="160" />
              <el-table-column prop="majorName" label="专业" min-width="140" />
              <el-table-column label="匹配度" width="90">
                <template #default="{ row }">{{ row.matchScore }}/100</template>
              </el-table-column>
              <el-table-column label="上岸概率" width="90">
                <template #default="{ row }">{{ row.probOfAdmission }}%</template>
              </el-table-column>
              <el-table-column label="难度" width="70">
                <template #default="{ row }">
                  <el-tag :type="diffTagType(row.difficulty)" size="small">{{ row.difficulty }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" link type="primary" @click="openFeedback(r.id, row.itemId)">标注修正</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="该生暂无 AI 推荐记录" />
    </el-card>

    <el-dialog v-model="feedbackDialog" title="推荐结果人工校准" width="500px">
      <el-form :model="feedbackForm" label-position="top">
        <el-form-item label="校准评语(供学生参考与模型优化)">
          <el-input v-model="feedbackForm.comment" type="textarea" :rows="5" placeholder="例:该生专业排名靠前,建议优先冲刺 985 院校;保底项偏保守,可适当上调..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feedbackDialog = false">取消</el-button>
        <el-button type="primary" :loading="feedbackLoading" @click="submitFeedback">提交校准</el-button>
      </template>
    </el-dialog>

    <el-card class="kygl-card">
      <template #header><span class="card-title">帮扶记录</span></template>
      <el-timeline v-if="student.helpApplications?.length > 0">
        <el-timeline-item v-for="app in student.helpApplications" :key="app.id" :timestamp="formatDate(app.createdAt)" placement="top">
          <strong>{{ helpTypeLabel(app.type) }}</strong>
          <p class="muted">{{ app.content }}</p>
          <el-button v-if="app.status === 'OPEN'" size="small" type="primary" @click="assignHelp(app)">接受对接</el-button>
          <el-button v-if="app.assigneeId === auth.user?.id" size="small" type="success" @click="recordHelp(app)">记录帮扶</el-button>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无帮扶申请" />
    </el-card>

    <el-dialog v-model="helpDialog" title="记录帮扶内容" width="500px">
      <el-form :model="helpForm" label-position="top">
        <el-form-item label="帮扶内容"><el-input v-model="helpForm.content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="帮扶效果"><el-input v-model="helpForm.effect" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="helpDialog = false">取消</el-button>
        <el-button type="primary" :loading="helpLoading" @click="submitHelp">提交并标记已解决</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { ProgressApi, MentorApi, AiApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import {
  stageLabel, stageTagType, helpTypeLabel,
  checkinStatusLabel, checkinStatusTagType,
} from '@/utils/stage';

const route = useRoute();
const auth = useAuthStore();
const student = ref<any>(null);
const isWatched = ref(false);
const helpDialog = ref(false);
const helpLoading = ref(false);
const helpForm = reactive({ content: '', effect: '', appId: 0 });

// AI 推荐展开 & 导师校准
const expandedRecom = reactive<Record<number, boolean>>({});
const feedbackDialog = ref(false);
const feedbackLoading = ref(false);
const feedbackForm = reactive({ recommendationId: 0, itemId: '', comment: '' });

function toggleRecom(id: number) {
  expandedRecom[id] = !expandedRecom[id];
}

function tierTagType(tier: string) {
  return tier === '冲刺' ? 'danger' : tier === '稳妥' ? 'warning' : 'success';
}

function diffTagType(d: string) {
  return d === '高' ? 'danger' : d === '中' ? 'warning' : 'success';
}

function openFeedback(recommendationId: number, itemId: string) {
  feedbackForm.recommendationId = recommendationId;
  feedbackForm.itemId = itemId;
  feedbackForm.comment = '';
  feedbackDialog.value = true;
}

async function submitFeedback() {
  if (!feedbackForm.comment.trim()) {
    ElMessage.warning('请填写校准评语');
    return;
  }
  feedbackLoading.value = true;
  try {
    await AiApi.feedback(feedbackForm.recommendationId, {
      itemId: feedbackForm.itemId,
      comment: feedbackForm.comment,
    });
    ElMessage.success('校准评语已提交,将持续优化推荐模型');
    feedbackDialog.value = false;
  } catch {
    /* 已提示 */
  } finally {
    feedbackLoading.value = false;
  }
}

function formatDate(d: string) {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '';
}

async function load() {
  try {
    student.value = await ProgressApi.studentArchive(Number(route.params.id));
  } catch {
    /* 已提示 */
  }
}

async function watch() {
  if (isWatched.value) {
    await MentorApi.unwatch(student.value.student.id);
    isWatched.value = false;
    ElMessage.success('已取消关注');
  } else {
    await MentorApi.watch(student.value.student.id);
    isWatched.value = true;
    ElMessage.success('已加入重点关注');
  }
}

function offerHelp(checkin: any) {
  helpForm.appId = 0;
  helpForm.content = `针对本周打卡反馈的困难:${checkin.difficulties}`;
  helpDialog.value = true;
}

async function assignHelp(app: any) {
  try {
    await MentorApi.assignHelp(app.id);
    ElMessage.success('已接受对接');
    await load();
  } catch {
    /* 已提示 */
  }
}

function recordHelp(app: any) {
  helpForm.appId = app.id;
  helpForm.content = '';
  helpForm.effect = '';
  helpDialog.value = true;
}

async function submitHelp() {
  if (!helpForm.content.trim()) {
    ElMessage.warning('请填写帮扶内容');
    return;
  }
  helpLoading.value = true;
  try {
    if (helpForm.appId) {
      await MentorApi.recordHelp(helpForm.appId, { content: helpForm.content, effect: helpForm.effect });
    }
    ElMessage.success('帮扶记录已保存,标记为已解决');
    helpDialog.value = false;
    await load();
  } catch {
    /* 已提示 */
  } finally {
    helpLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
.mt-16 { margin-top: 16px; }
.mt-8 { margin-top: 8px; }
.ml-8 { margin-left: 8px; }
.muted { color: #909399; margin: 4px 0; }
.small { font-size: 13px; }
.actions { text-align: center; }
.checkin-item { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.recom-head { display: flex; justify-content: space-between; align-items: center; }
.recom-items { margin-top: 8px; }
.llm-summary { white-space: pre-wrap; line-height: 1.6; }
</style>
