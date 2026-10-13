<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true" :model="filter">
        <el-form-item label="角色">
          <el-select v-model="filter.role" clearable placeholder="全部" style="width: 140px" @change="load">
            <el-option label="学生" value="STUDENT" />
            <el-option label="辅导员" value="COUNSELOR" />
            <el-option label="专业导师" value="MAJOR_MENTOR" />
            <el-option label="教学管理员" value="ACADEMIC_ADMIN" />
            <el-option label="系统管理员" value="SYS_ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filter.keyword" clearable placeholder="姓名/学号" style="width: 160px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">查询</el-button>
          <el-button type="success" @click="dialog = true"><el-icon><Plus /></el-icon> 新增用户</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <el-table :data="list" stripe>
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="username" label="用户名/学号" width="120" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">{{ roleLabel(row.role) }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="email" label="邮箱" width="180" />
        <el-table-column label="院系" width="140">
          <template #default="{ row }">{{ row.department?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
              {{ row.status === 'ACTIVE' ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="edit(row)">编辑</el-button>
            <el-button size="small" type="warning" link @click="resetPwd(row)">重置密码</el-button>
            <el-button v-if="row.role !== 'SYS_ADMIN'" size="small" type="danger" link @click="remove(row)">停用</el-button>
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

    <el-dialog v-model="dialog" :title="form.id ? '编辑用户' : '新增用户'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="用户名" required><el-input v-model="form.username" :disabled="!!form.id" /></el-form-item>
        <el-form-item label="姓名" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="学生" value="STUDENT" />
            <el-option label="辅导员" value="COUNSELOR" />
            <el-option label="专业导师" value="MAJOR_MENTOR" />
            <el-option label="教学管理员" value="ACADEMIC_ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="学号/工号"><el-input v-model="form.studentNo || form.staffNo" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="院系">
          <el-select v-model="form.departmentId" style="width: 100%" @change="onDeptChange">
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="专业">
          <el-select v-model="form.majorId" clearable style="width: 100%">
            <el-option v-for="m in majorOptions" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级(学生)">
          <el-select v-model="form.classId" clearable style="width: 100%">
            <el-option v-for="c in classOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UsersApi, AdminApi } from '@/api';

const list = ref<any[]>([]);
const total = ref(0);
const departments = ref<any[]>([]);
const majorOptions = ref<any[]>([]);
const classOptions = ref<any[]>([]);
const dialog = ref(false);
const loading = ref(false);
const filter = reactive({ role: '', keyword: '', page: 1, pageSize: 20 });
const form = reactive<any>({ id: undefined, username: '', name: '', role: 'STUDENT', studentNo: '', staffNo: '', phone: '', email: '', departmentId: undefined, majorId: undefined, classId: undefined });

function roleLabel(r: string) {
  return { STUDENT: '学生', COUNSELOR: '辅导员', MAJOR_MENTOR: '专业导师', ACADEMIC_ADMIN: '教学管理员', SYS_ADMIN: '系统管理员' }[r] ?? r;
}

async function load() {
  try {
    const res: any = await UsersApi.list(filter);
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  }
}

function edit(row: any) {
  Object.assign(form, row);
  if (form.departmentId) onDeptChange();
  dialog.value = true;
}

async function onDeptChange() {
  majorOptions.value = (await AdminApi.listMajors(form.departmentId)) as any;
  classOptions.value = (await AdminApi.listClasses({ departmentId: form.departmentId })) as any;
}

async function submit() {
  loading.value = true;
  try {
    if (form.id) {
      await UsersApi.update(form.id, form);
    } else {
      await UsersApi.create(form);
    }
    ElMessage.success('保存成功');
    dialog.value = false;
    await load();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function resetPwd(row: any) {
  try {
    await ElMessageBox.confirm(`确认将 ${row.name} 的密码重置为 ${row.username}@2026?`, '提示', { type: 'warning' });
    await UsersApi.update(row.id, { resetPassword: true });
    ElMessage.success('密码已重置');
  } catch {
    /* 已提示 */
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确认停用 ${row.name} 账号?`, '提示', { type: 'warning' });
    await UsersApi.remove(row.id);
    ElMessage.success('已停用');
    await load();
  } catch {
    /* 已提示 */
  }
}

async function loadScope() {
  departments.value = (await AdminApi.listDepartments()) as any;
}

onMounted(() => {
  loadScope();
  load();
});
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.mt-16 { margin-top: 16px; }
</style>
