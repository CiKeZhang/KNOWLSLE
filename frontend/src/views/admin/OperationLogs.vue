<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true" :model="filter">
        <el-form-item label="用户ID">
          <el-input v-model="filter.userId" clearable placeholder="操作者用户ID" style="width: 120px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filter.action" clearable placeholder="全部" style="width: 200px" @change="load">
            <el-option v-for="a in actionOptions" :key="a" :label="actionLabel(a)" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
            @change="onDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="操作人" width="160">
          <template #default="{ row }">
            <span v-if="row.user">{{ row.user.name }} <el-tag size="small" type="info">{{ roleLabel(row.user.role) }}</el-tag></span>
            <span v-else>用户#{{ row.userId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作类型" width="220">
          <template #default="{ row }">
            <el-tag size="small">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="操作对象" width="200" show-overflow-tooltip />
        <el-table-column label="详情" min-width="280">
          <template #default="{ row }">
            <el-popover trigger="hover" width="480" placement="left">
              <template #reference>
                <span class="detail-preview">{{ formatDetail(row.detail) }}</span>
              </template>
              <pre class="detail-json">{{ JSON.stringify(row.detail, null, 2) }}</pre>
            </el-popover>
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-16"
        v-model:current-page="filter.page"
        :page-size="filter.pageSize"
        :total="total"
        layout="total, prev, pager, next, jumper"
        @current-change="load"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { AdminApi } from '@/api';

const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const dateRange = ref<[string, string] | null>(null);
const filter = reactive<any>({
  page: 1,
  pageSize: 20,
  userId: '',
  action: '',
  startTime: undefined,
  endTime: undefined,
});

// 全量已知操作类型(后端 OperationLogService 记录的 action)
const actionOptions = [
  'login',
  'logout',
  'create_user',
  'update_user',
  'reset_password',
  'batch_import',
  'checkin_submit',
  'checkin_makeup_apply',
  'checkin_makeup_approve',
  'checkin_makeup_reject',
  'update_archive',
  'update_checkin_rule',
  'create_school',
  'update_school',
  'delete_school',
  'create_program',
  'update_program',
  'create_department',
  'create_major',
  'create_class',
  'create_resource',
  'update_resource',
  'review_resource',
  'ai_recommend',
  'help_apply',
  'help_reply',
  'help_close',
  'update_config',
  'update_key_node',
  'send_notification',
  'mark_focus',
];

function actionLabel(a: string) {
  const m: Record<string, string> = {
    login: '登录',
    logout: '退出',
    create_user: '新增用户',
    update_user: '更新用户',
    reset_password: '重置密码',
    batch_import: '批量导入',
    checkin_submit: '提交打卡',
    checkin_makeup_apply: '补卡申请',
    checkin_makeup_approve: '补卡通过',
    checkin_makeup_reject: '补卡驳回',
    update_archive: '更新档案',
    update_checkin_rule: '更新打卡规则',
    create_school: '新增院校',
    update_school: '更新院校',
    delete_school: '删除院校',
    create_program: '新增招生专业',
    update_program: '更新招生专业',
    create_department: '新增院系',
    create_major: '新增专业',
    create_class: '新增班级',
    create_resource: '上传资源',
    update_resource: '更新资源',
    review_resource: '资源审核',
    ai_recommend: 'AI 推荐',
    help_apply: '帮扶申请',
    help_reply: '帮扶回复',
    help_close: '帮扶关闭',
    update_config: '更新配置',
    update_key_node: '更新关键节点',
    send_notification: '发送通知',
    mark_focus: '标记重点关注',
  };
  return m[a] ?? a;
}

function roleLabel(r: string) {
  return { STUDENT: '学生', COUNSELOR: '辅导员', MAJOR_MENTOR: '专业导师', ACADEMIC_ADMIN: '教学管理员', SYS_ADMIN: '系统管理员' }[r] ?? r;
}

function formatTime(t: string) {
  return dayjs(t).format('YYYY-MM-DD HH:mm:ss');
}

function formatDetail(d: any) {
  if (!d) return '—';
  const s = typeof d === 'object' ? JSON.stringify(d) : String(d);
  return s.length > 60 ? s.slice(0, 60) + '...' : s;
}

function onDateChange(val: [string, string] | null) {
  if (val) {
    filter.startTime = val[0];
    filter.endTime = val[1];
  } else {
    filter.startTime = undefined;
    filter.endTime = undefined;
  }
}

async function load() {
  loading.value = true;
  try {
    const params: any = {
      page: filter.page,
      pageSize: filter.pageSize,
    };
    if (filter.userId) params.userId = filter.userId;
    if (filter.action) params.action = filter.action;
    if (filter.startTime) params.startTime = filter.startTime;
    if (filter.endTime) params.endTime = filter.endTime;
    const res: any = await AdminApi.operationLogs(params);
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

function reset() {
  filter.userId = '';
  filter.action = '';
  filter.startTime = undefined;
  filter.endTime = undefined;
  dateRange.value = null;
  filter.page = 1;
  load();
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.mt-16 { margin-top: 16px; }
.detail-preview {
  display: inline-block;
  max-width: 100%;
  color: #606266;
  font-size: 12px;
  font-family: 'Menlo', 'Consolas', monospace;
}
.detail-json {
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
}
</style>
