<template>
  <el-dialog
    :model-value="visible"
    title="修改密码"
    width="420px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirm">
        <el-input v-model="form.confirm" type="password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { AuthApi } from '@/api';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'update:visible', val: boolean): void }>();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' });
const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, val: string, cb: any) => {
        if (val !== form.newPassword) cb(new Error('两次密码不一致'));
        else cb();
      },
      trigger: 'blur',
    },
  ],
};

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (ok) => {
    if (!ok) return;
    loading.value = true;
    try {
      await AuthApi.changePassword(form.oldPassword, form.newPassword);
      ElMessage.success('密码修改成功');
      emit('update:visible', false);
      form.oldPassword = form.newPassword = form.confirm = '';
    } catch {
      /* 错误已由拦截器提示 */
    } finally {
      loading.value = false;
    }
  });
}
</script>
