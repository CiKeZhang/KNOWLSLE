<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <template #header><span class="card-title">批量导入用户</span></template>
      <el-alert type="info" :closable="false" title="通过 Excel 批量导入学生/导师信息。下载模板,填写后上传解析并确认导入。" class="mb-16" />
      <el-steps :active="step" finish-status="success">
        <el-step title="下载模板" />
        <el-step title="上传 Excel" />
        <el-step title="预览数据" />
        <el-step title="确认导入" />
      </el-steps>
      <div class="step-content">
        <div v-if="step === 0">
          <el-button type="primary" @click="downloadTemplate">下载 Excel 模板</el-button>
        </div>
        <div v-if="step === 1">
          <el-upload :auto-upload="false" :on-change="onFileChange" accept=".xlsx,.xls">
            <el-button type="primary"><el-icon><Upload /></el-icon> 选择 Excel 文件</el-button>
          </el-upload>
        </div>
        <div v-if="step === 2">
          <p class="muted">共解析出 {{ parsed.length }} 条记录:</p>
          <el-table :data="parsed" border style="max-height: 400px; overflow-y: auto">
            <el-table-column prop="username" label="用户名/学号" width="120" />
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="role" label="角色" width="100" />
            <el-table-column prop="majorCode" label="专业代码" width="100" />
            <el-table-column prop="className" label="班级" width="120" />
            <el-table-column prop="phone" label="手机号" width="140" />
          </el-table>
        </div>
        <div v-if="step === 3">
          <el-result icon="success" title="导入完成" :sub-title="`成功 ${successCount} 条,失败 ${failCount} 条`">
            <template #extra>
              <el-button @click="reset">再次导入</el-button>
            </template>
          </el-result>
        </div>
      </div>
      <div class="mt-16" v-if="step === 2">
        <el-button @click="step = 1">上一步</el-button>
        <el-button type="primary" :loading="importing" @click="doImport">确认导入</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import * as XLSX from 'xlsx';
import { UsersApi } from '@/api';

const step = ref(0);
const parsed = ref<any[]>([]);
const importing = ref(false);
const successCount = ref(0);
const failCount = ref(0);

function downloadTemplate() {
  const data = [
    ['用户名/学号', '姓名', '角色(STUDENT/COUNSELOR/MAJOR_MENTOR/ACADEMIC_ADMIN)', '专业代码', '班级名称', '手机号', '密码(留空默认 用户名@2026)'],
    ['20210002', '王同学', 'STUDENT', 'ACCT', '会计2101', '13800138000', ''],
    ['20210003', '李同学', 'STUDENT', 'FIN', '金融2101', '13800138001', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '用户导入模板');
  XLSX.writeFile(wb, '用户导入模板.xlsx');
}

async function onFileChange(file: any) {
  const ab = await file.raw.arrayBuffer();
  const wb = XLSX.read(ab);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const parsed_: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    parsed_.push({
      username: String(r[0] ?? '').trim(),
      name: String(r[1] ?? '').trim(),
      role: String(r[2] ?? 'STUDENT').trim(),
      majorCode: String(r[3] ?? '').trim(),
      className: String(r[4] ?? '').trim(),
      phone: String(r[5] ?? '').trim(),
      password: String(r[6] ?? '').trim() || undefined,
    });
  }
  if (parsed_.length === 0) {
    ElMessage.warning('未解析到有效记录');
    return;
  }
  parsed.value = parsed_;
  step.value = 2;
}

async function doImport() {
  importing.value = true;
  try {
    const res: any = await UsersApi.batchImport(parsed.value);
    successCount.value = res.success;
    failCount.value = res.fail;
    step.value = 3;
    ElMessage.success(`导入完成:成功 ${res.success} / 失败 ${res.fail}`);
  } catch {
    /* 已提示 */
  } finally {
    importing.value = false;
  }
}

function reset() {
  step.value = 0;
  parsed.value = [];
  successCount.value = 0;
  failCount.value = 0;
}
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
.muted { color: #909399; }
.mb-16 { margin-bottom: 16px; }
.mt-16 { margin-top: 16px; }
.step-content { padding: 24px 0; min-height: 200px; }
</style>
