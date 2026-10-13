<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">打卡规则配置</span></template>
      <el-form :model="form" label-width="200px" v-if="form">
        <el-divider content-position="left">打卡周期</el-divider>
        <el-form-item label="打卡周期">
          <el-radio-group v-model="form.period">
            <el-radio value="WEEKLY">自然周(每周一至周日)</el-radio>
            <el-radio value="BIWEEKLY">双周</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="每日打卡开始时间">
          <el-time-picker v-model="startAt" format="HH:mm" value-format="HH:mm" placeholder="00:00" />
        </el-form-item>
        <el-form-item label="每日打卡截止时间">
          <el-time-picker v-model="endAt" format="HH:mm" value-format="HH:mm" placeholder="23:59" />
        </el-form-item>
        <el-divider content-position="left">提醒机制</el-divider>
        <el-form-item label="周五提醒发送时间">
          <el-time-picker v-model="fridayRemindAt" format="HH:mm" value-format="HH:mm" />
        </el-form-item>
        <el-form-item label="周日逾期预警时间">
          <el-time-picker v-model="sundayAlertAt" format="HH:mm" value-format="HH:mm" />
        </el-form-item>
        <el-divider content-position="left">必填项配置</el-divider>
        <el-form-item label="必填:当前流程节点"><el-switch v-model="form.requireStage" /></el-form-item>
        <el-form-item label="必填:本周完成事项"><el-switch v-model="form.requireCompletedItems" /></el-form-item>
        <el-form-item label="必填:本周备考困难"><el-switch v-model="form.requireDifficulties" /></el-form-item>
        <el-divider content-position="left">补卡功能</el-divider>
        <el-form-item label="开启补卡功能"><el-switch v-model="form.makeupEnabled" /></el-form-item>
        <el-form-item label="补卡有效期(天)">
          <el-input-number v-model="form.makeupValidDays" :min="1" :max="30" />
        </el-form-item>
        <el-form-item label="补卡审批角色">
          <el-select v-model="form.makeupApproverRole" style="width: 200px">
            <el-option label="辅导员" value="COUNSELOR" />
            <el-option label="专业导师" value="MAJOR_MENTOR" />
            <el-option label="教学管理员" value="ACADEMIC_ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则启用"><el-switch v-model="form.enabled" /></el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { AdminApi } from '@/api';

const form = ref<any>(null);
const startAt = ref('00:00');
const endAt = ref('23:59');
const fridayRemindAt = ref('18:00');
const sundayAlertAt = ref('20:00');
const saving = ref(false);

async function load() {
  try {
    form.value = await AdminApi.getCheckInRule();
    if (form.value) {
      startAt.value = form.value.startAt ?? '00:00';
      endAt.value = form.value.endAt ?? '23:59';
      fridayRemindAt.value = form.value.fridayRemindAt ?? '18:00';
      sundayAlertAt.value = form.value.sundayAlertAt ?? '20:00';
    }
  } catch {
    /* 已提示 */
  }
}

async function save() {
  saving.value = true;
  try {
    await AdminApi.updateCheckInRule({
      ...form.value,
      startAt: startAt.value,
      endAt: endAt.value,
      fridayRemindAt: fridayRemindAt.value,
      sundayAlertAt: sundayAlertAt.value,
    });
    ElMessage.success('打卡规则已保存');
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
</style>
