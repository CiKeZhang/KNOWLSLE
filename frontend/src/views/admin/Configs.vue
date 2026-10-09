<template>
  <div class="kygl-page">
    <!-- 关键节点提醒 -->
    <el-card class="kygl-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">考研关键节点提醒</span>
          <span class="card-hint">预报名 / 正式报名 / 现场确认 / 初试 / 成绩公布 / 国家线 / 复试 / 调剂</span>
        </div>
      </template>
      <el-table :data="keyNodes" stripe v-loading="loadingNodes">
        <el-table-column prop="name" label="节点名称" width="160" />
        <el-table-column prop="nodeKey" label="节点标识" width="160" />
        <el-table-column label="提醒时间" width="200">
          <template #default="{ row }">
            <el-date-picker
              v-model="row.remindAt"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DDTHH:mm:ss"
              :disabled="!editingNode[row.id]"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column label="描述" min-width="220">
          <template #default="{ row }">
            <el-input v-model="row.description" :disabled="!editingNode[row.id]" type="textarea" :rows="1" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" :disabled="!editingNode[row.id]" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!editingNode[row.id]" size="small" link @click="editingNode[row.id] = true">编辑</el-button>
            <el-button v-else size="small" type="primary" link :loading="savingNode[row.id]" @click="saveNode(row)">保存</el-button>
            <el-button v-if="editingNode[row.id]" size="small" link @click="cancelNode(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 系统配置项 -->
    <el-card class="kygl-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">系统配置项</span>
          <el-button type="primary" size="small" @click="dialog = true"><el-icon><Plus /></el-icon> 新增配置</el-button>
        </div>
      </template>
      <el-table :data="configs" stripe v-loading="loadingConfigs">
        <el-table-column prop="key" label="配置键" width="220" />
        <el-table-column label="配置值" min-width="280">
          <template #default="{ row }">
            <code class="config-value">{{ formatValue(row.value) }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="editConfig(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 内置规则快捷编辑面板 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">预警规则配置</span></template>
      <el-form label-width="280px" v-loading="loadingAlertRules">
        <el-divider content-position="left">打卡异常</el-divider>
        <el-form-item label="当周逾期未打卡预警">
          <el-switch v-model="alertRules.checkin_missing.enabled" />
        </el-form-item>
        <el-form-item label="连续 N 周未打卡预警">
          <el-input-number v-model="alertRules.checkin_streak.weeks" :min="2" :max="10" />
        </el-form-item>
        <el-form-item label="连续 N 周进度无更新预警">
          <el-input-number v-model="alertRules.progress_stagnant.weeks" :min="2" :max="10" />
        </el-form-item>
        <el-divider content-position="left">进度异常</el-divider>
        <el-form-item label="进度滞后于均值 N% 预警">
          <el-input-number v-model="alertRules.progress_lag.percent" :min="5" :max="50" />
        </el-form-item>
        <el-form-item label="初试成绩未达国家线预警">
          <el-switch v-model="alertRules.below_national_line.enabled" />
        </el-form-item>
        <el-form-item label="调剂无进展 N 周预警">
          <el-input-number v-model="alertRules.adjustment_stagnant.weeks" :min="1" :max="10" />
        </el-form-item>
        <el-divider content-position="left">状态异常</el-divider>
        <el-form-item label="连续 N 天未登录预警">
          <el-input-number v-model="alertRules.inactive.days" :min="7" :max="60" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="savingAlertRules" @click="saveAlertRules">保存预警规则</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 通知通道配置 -->
    <el-card class="kygl-card">
      <template #header><span class="card-title">通知通道配置</span></template>
      <el-form label-width="200px" v-loading="loadingNotify">
        <el-divider content-position="left">站内消息</el-divider>
        <el-form-item label="站内消息通道">
          <el-switch v-model="notifyChannels.in_app.enabled" />
        </el-form-item>
        <el-divider content-position="left">企业微信</el-divider>
        <el-form-item label="企业微信通道">
          <el-switch v-model="notifyChannels.wecom.enabled" />
        </el-form-item>
        <el-form-item label="企业微信 CorpID">
          <el-input v-model="notifyChannels.wecom.corp_id" placeholder="ww..." style="width: 320px" />
        </el-form-item>
        <el-form-item label="企业微信 AgentID">
          <el-input v-model="notifyChannels.wecom.agent_id" placeholder="应用 AgentID" style="width: 320px" />
        </el-form-item>
        <el-form-item label="企业微信 Secret">
          <el-input v-model="notifyChannels.wecom.secret" type="password" show-password placeholder="应用 Secret" style="width: 320px" />
        </el-form-item>
        <el-divider content-position="left">短信</el-divider>
        <el-form-item label="短信通道">
          <el-switch v-model="notifyChannels.sms.enabled" />
        </el-form-item>
        <el-form-item label="短信服务商">
          <el-select v-model="notifyChannels.sms.provider" style="width: 200px">
            <el-option label="阿里云" value="aliyun" />
            <el-option label="腾讯云" value="tencent" />
          </el-select>
        </el-form-item>
        <el-form-item label="AccessKey ID">
          <el-input v-model="notifyChannels.sms.access_key_id" style="width: 320px" />
        </el-form-item>
        <el-form-item label="AccessKey Secret">
          <el-input v-model="notifyChannels.sms.access_key_secret" type="password" show-password style="width: 320px" />
        </el-form-item>
        <el-form-item label="短信签名">
          <el-input v-model="notifyChannels.sms.sign_name" style="width: 320px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="savingNotify" @click="saveNotify">保存通知通道</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 通用配置新增/编辑弹窗 -->
    <el-dialog v-model="dialog" :title="configForm.id ? '编辑配置' : '新增配置'" width="600px">
      <el-form :model="configForm" label-width="100px">
        <el-form-item label="配置键" required>
          <el-input v-model="configForm.key" :disabled="!!configForm.id" placeholder="如 alert_rules / notify_channels" />
        </el-form-item>
        <el-form-item label="配置值" required>
          <el-input v-model="configForm.valueText" type="textarea" :rows="8" placeholder="JSON 格式" />
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="configForm.description" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { AdminApi } from '@/api';

// ===== 关键节点 =====
const keyNodes = ref<any[]>([]);
const loadingNodes = ref(false);
const editingNode = reactive<Record<number, boolean>>({});
const savingNode = reactive<Record<number, boolean>>({});
const nodeSnapshots = reactive<Record<number, any>>({});

async function loadKeyNodes() {
  loadingNodes.value = true;
  try {
    keyNodes.value = (await AdminApi.listKeyNodes()) as any;
    keyNodes.value.forEach((n) => { editingNode[n.id] = false; });
  } catch {
    /* 已提示 */
  } finally {
    loadingNodes.value = false;
  }
}

function cancelNode(row: any) {
  if (nodeSnapshots[row.id]) {
    Object.assign(row, JSON.parse(JSON.stringify(nodeSnapshots[row.id])));
  }
  editingNode[row.id] = false;
}

async function saveNode(row: any) {
  savingNode[row.id] = true;
  try {
    await AdminApi.updateKeyNode(row.id, {
      remindAt: row.remindAt,
      enabled: row.enabled,
      description: row.description,
    });
    ElMessage.success('节点已更新');
    editingNode[row.id] = false;
  } catch {
    /* 已提示 */
  } finally {
    savingNode[row.id] = false;
  }
}

// ===== 通用系统配置 =====
const configs = ref<any[]>([]);
const loadingConfigs = ref(false);
const dialog = ref(false);
const saving = ref(false);
const configForm = reactive<any>({ id: undefined, key: '', valueText: '', description: '' });

async function loadConfigs() {
  loadingConfigs.value = true;
  try {
    configs.value = (await AdminApi.listConfigs()) as any;
  } catch {
    /* 已提示 */
  } finally {
    loadingConfigs.value = false;
  }
}

function formatValue(v: any) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function editConfig(row: any) {
  Object.assign(configForm, {
    id: row.id,
    key: row.key,
    valueText: typeof row.value === 'object' ? JSON.stringify(row.value, null, 2) : String(row.value),
    description: row.description || '',
  });
  dialog.value = true;
}

async function saveConfig() {
  let parsed: any;
  try {
    parsed = JSON.parse(configForm.valueText || 'null');
  } catch {
    ElMessage.error('配置值不是合法 JSON');
    return;
  }
  saving.value = true;
  try {
    await AdminApi.updateConfig(configForm.key, parsed, configForm.description || '');
    ElMessage.success('配置已保存');
    dialog.value = false;
    await loadConfigs();
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

// ===== 预警规则 =====
const alertRules = reactive<any>({
  checkin_missing: { enabled: true },
  checkin_streak: { weeks: 2 },
  progress_stagnant: { weeks: 3 },
  progress_lag: { percent: 20 },
  below_national_line: { enabled: true },
  adjustment_stagnant: { weeks: 2 },
  inactive: { days: 15 },
});
const loadingAlertRules = ref(false);
const savingAlertRules = ref(false);

async function loadAlertRules() {
  loadingAlertRules.value = true;
  try {
    const c: any = await AdminApi.getConfig('alert_rules');
    if (c?.value) Object.assign(alertRules, c.value);
  } catch {
    /* 首次未配置,使用默认值 */
  } finally {
    loadingAlertRules.value = false;
  }
}

async function saveAlertRules() {
  savingAlertRules.value = true;
  try {
    await AdminApi.updateConfig('alert_rules', alertRules, '预警规则配置');
    ElMessage.success('预警规则已保存');
  } catch {
    /* 已提示 */
  } finally {
    savingAlertRules.value = false;
  }
}

// ===== 通知通道 =====
const notifyChannels = reactive<any>({
  in_app: { enabled: true },
  wecom: { enabled: false, corp_id: '', agent_id: '', secret: '' },
  sms: { enabled: false, provider: 'aliyun', access_key_id: '', access_key_secret: '', sign_name: '' },
});
const loadingNotify = ref(false);
const savingNotify = ref(false);

async function loadNotify() {
  loadingNotify.value = true;
  try {
    const c: any = await AdminApi.getConfig('notify_channels');
    if (c?.value) Object.assign(notifyChannels, c.value);
  } catch {
    /* 未配置 */
  } finally {
    loadingNotify.value = false;
  }
}

async function saveNotify() {
  savingNotify.value = true;
  try {
    await AdminApi.updateConfig('notify_channels', notifyChannels, '通知通道配置');
    ElMessage.success('通知通道已保存');
  } catch {
    /* 已提示 */
  } finally {
    savingNotify.value = false;
  }
}

onMounted(() => {
  loadKeyNodes();
  loadConfigs();
  loadAlertRules();
  loadNotify();
});
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-weight: 600; }
.card-hint { color: #909399; font-size: 12px; }
.config-value {
  display: block;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
