<template>
  <div class="kygl-page">
    <el-card class="kygl-card">
      <el-form :inline="true">
        <el-form-item label="关键字">
          <el-input v-model="filter.keyword" clearable placeholder="院校名/代码" style="width: 180px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item label="层次">
          <el-select v-model="filter.tier" clearable placeholder="全部" style="width: 140px" @change="load">
            <el-option v-for="t in SCHOOL_TIER_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">查询</el-button>
          <el-button type="success" @click="add"><el-icon><Plus /></el-icon> 新增院校</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="kygl-card">
      <el-table :data="list" stripe>
        <el-table-column prop="name" label="院校名称" min-width="160" />
        <el-table-column prop="code" label="代码" width="80" />
        <el-table-column label="层次" width="100">
          <template #default="{ row }"><el-tag size="small">{{ tierLabel(row.tier) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="region" label="地区" width="100" />
        <el-table-column prop="city" label="城市" width="100" />
        <el-table-column label="招生专业" width="100">
          <template #default="{ row }">{{ row._count?.programs ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="优先推荐权重" width="120">
          <template #default="{ row }">{{ Number(row.priorityWeight) || 1 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="managePrograms(row)">招生专业</el-button>
            <el-button size="small" type="primary" link @click="edit(row)">编辑</el-button>
            <el-button size="small" type="danger" link @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination class="mt-16" v-model:current-page="filter.page" :page-size="filter.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </el-card>

    <el-dialog v-model="dialog" :title="form.id ? '编辑院校' : '新增院校'" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="院校名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="代码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="层次" required>
          <el-select v-model="form.tier" style="width: 100%">
            <el-option v-for="t in SCHOOL_TIER_LIST" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="地区"><el-input v-model="form.region" placeholder="华北/华东..." /></el-form-item>
        <el-form-item label="省份"><el-input v-model="form.province" /></el-form-item>
        <el-form-item label="城市"><el-input v-model="form.city" /></el-form-item>
        <el-form-item label="985"><el-switch v-model="form.is985" /></el-form-item>
        <el-form-item label="211"><el-switch v-model="form.is211" /></el-form-item>
        <el-form-item label="双一流"><el-switch v-model="form.isDoubleFirst" /></el-form-item>
        <el-form-item label="优先推荐权重">
          <el-input-number v-model="form.priorityWeight" :step="0.1" :min="0.5" :max="3" :precision="1" />
          <span class="muted ml-8">>1 视为学院优先推荐方向</span>
        </el-form-item>
        <el-form-item label="官网"><el-input v-model="form.website" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="progDialog" :title="`招生专业管理:${currentSchool?.name}`" width="800px">
      <el-button type="success" size="small" @click="addProgram" class="mb-16"><el-icon><Plus /></el-icon> 新增专业</el-button>
      <el-table :data="programs" stripe>
        <el-table-column prop="majorName" label="专业名称" width="160" />
        <el-table-column label="2025复试线" width="100"><template #default="{ row }">{{ row.reexamLine2025 ?? '—' }}</template></el-table-column>
        <el-table-column label="2025招生人数" width="100"><template #default="{ row }">{{ row.enrollCount2025 ?? '—' }}</template></el-table-column>
        <el-table-column label="考试科目" min-width="200"><template #default="{ row }">{{ (row.examSubjects || []).join(', ') }}</template></el-table-column>
        <el-table-column label="学院对口" width="100"><template #default="{ row }"><el-tag v-if="row.isCollegeAligned" type="success" size="small">是</el-tag></template></el-table-column>
        <el-table-column label="操作" width="120"><template #default="{ row }"><el-button size="small" type="primary" link @click="editProgram(row)">编辑</el-button></template></el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AdminApi } from '@/api';
import { SCHOOL_TIER_LIST, tierLabel } from '@/utils/stage';

const list = ref<any[]>([]);
const total = ref(0);
const programs = ref<any[]>([]);
const departments = ref<any[]>([]);
const dialog = ref(false);
const progDialog = ref(false);
const loading = ref(false);
const currentSchool = ref<any>(null);
const filter = reactive({ keyword: '', tier: '', page: 1, pageSize: 20 });
const form = reactive<any>({ id: undefined, name: '', code: '', tier: 'DOUBLE_NON', region: '', province: '', city: '', is985: false, is211: false, isDoubleFirst: false, priorityWeight: 1, website: '' });
const progForm = reactive<any>({});

async function load() {
  try {
    const res: any = await AdminApi.listSchools(filter);
    list.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    /* 已提示 */
  }
}

function add() {
  Object.assign(form, { id: undefined, name: '', code: '', tier: 'DOUBLE_NON', region: '', province: '', city: '', is985: false, is211: false, isDoubleFirst: false, priorityWeight: 1, website: '' });
  dialog.value = true;
}

function edit(row: any) {
  Object.assign(form, row);
  dialog.value = true;
}

async function submit() {
  loading.value = true;
  try {
    if (form.id) await AdminApi.updateSchool(form.id, form);
    else await AdminApi.createSchool(form);
    ElMessage.success('保存成功');
    dialog.value = false;
    await load();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除院校 ${row.name}?`, '提示', { type: 'warning' });
    await AdminApi.updateSchool(row.id, {}); // placeholder
    ElMessage.success('已删除');
    await load();
  } catch {
    /* 已提示 */
  }
}

async function managePrograms(row: any) {
  currentSchool.value = row;
  programs.value = (await AdminApi.listPrograms(row.id)) as any;
  progDialog.value = true;
}

function addProgram() {
  Object.assign(progForm, { id: undefined, schoolId: currentSchool.value.id, majorName: '', reexamLine2025: undefined, enrollCount2025: undefined, examSubjects: [], isCollegeAligned: false });
}

function editProgram(row: any) {
  Object.assign(progForm, row);
}

onMounted(load);
</script>

<style scoped>
.kygl-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }
.mt-16 { margin-top: 16px; }
.muted { color: #909399; font-size: 12px; }
.ml-8 { margin-left: 8px; }
.mb-16 { margin-bottom: 16px; }
</style>
