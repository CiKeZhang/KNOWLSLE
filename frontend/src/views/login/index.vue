<template>
  <div class="login-page">
    <div class="login-box">
      <div class="login-header">
        <h1>学院考研进度管控系统</h1>
        <p class="subtitle">进度可视化 · 帮扶精准化 · 备考智能化</p>
      </div>
      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="账号登录" name="login">
          <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent>
            <el-form-item prop="username">
              <el-input
                v-model="form.username"
                placeholder="学号 / 工号 / 用户名"
                size="large"
                :prefix-icon="User"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="密码"
                size="large"
                :prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >登 录</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="首次部署初始化" name="bootstrap">
          <el-alert
            title="仅当系统中无任何管理员时可用。初始化后请立即登录修改。"
            type="warning"
            :closable="false"
            class="mb-16"
          />
          <el-form :model="bootForm" :rules="bootRules" ref="bootFormRef">
            <el-form-item prop="username">
              <el-input v-model="bootForm.username" placeholder="管理员用户名" size="large" :prefix-icon="User" />
            </el-form-item>
            <el-form-item prop="name">
              <el-input v-model="bootForm.name" placeholder="管理员姓名" size="large" :prefix-icon="UserFilled" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="bootForm.password" type="password" placeholder="至少 8 位密码" size="large" :prefix-icon="Lock" show-password />
            </el-form-item>
            <el-button type="primary" size="large" class="login-btn" :loading="bootLoading" @click="handleBootstrap">
              初始化系统管理员
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <div class="demo-accounts" v-if="showDemo">
        <p class="demo-title">演示账号(点击自动填充):</p>
        <el-space wrap>
          <el-tag v-for="acc in demoAccounts" :key="acc.username" @click="useDemo(acc)" class="demo-tag">
            {{ acc.role }}: {{ acc.username }}
          </el-tag>
        </el-space>
      </div>
    </div>
    <p class="footer">© 2026 学院考研进度管控与智能辅导双端系统</p>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { User, Lock, UserFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { AuthApi } from '@/api';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const activeTab = ref('login');
const formRef = ref<FormInstance>();
const bootFormRef = ref<FormInstance>();
const loading = ref(false);
const bootLoading = ref(false);

const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const bootForm = reactive({ username: '', name: '', password: '' });
const bootRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
  ],
};

const showDemo = ref(import.meta.env.DEV ?? false);
const demoAccounts = [
  { role: '管理员', username: 'admin', password: 'admin@2026' },
  { role: '教学管理员', username: 'academic', password: 'academic@2026' },
  { role: '辅导员', username: 'counselor1', password: 'counselor@2026' },
  { role: '专业导师', username: 'mentor1', password: 'mentor@2026' },
  { role: '学生', username: '20210001', password: 'student@2026' },
];

function useDemo(acc: { username: string; password: string }) {
  form.username = acc.username;
  form.password = acc.password;
  activeTab.value = 'login';
}

async function handleLogin() {
  if (!formRef.value) return;
  await formRef.value.validate(async (ok) => {
    if (!ok) return;
    loading.value = true;
    try {
      await auth.login(form.username, form.password);
      ElMessage.success('登录成功');
      const redirect = (route.query.redirect as string) || '/';
      router.push(redirect);
    } catch {
      /* 错误已由拦截器提示 */
    } finally {
      loading.value = false;
    }
  });
}

async function handleBootstrap() {
  if (!bootFormRef.value) return;
  await bootFormRef.value.validate(async (ok) => {
    if (!ok) return;
    bootLoading.value = true;
    try {
      await AuthApi.bootstrapAdmin(bootForm.username, bootForm.password, bootForm.name);
      ElMessage.success('初始化成功,请使用该账号登录');
      form.username = bootForm.username;
      form.password = '';
      activeTab.value = 'login';
    } catch {
      /* 错误已由拦截器提示 */
    } finally {
      bootLoading.value = false;
    }
  });
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1d5fb0 0%, #2a7ae0 50%, #4a90e2 100%);
  padding: 16px;
}
.login-box {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}
.login-header { text-align: center; margin-bottom: 24px; }
.login-header h1 { font-size: 22px; color: #2a7ae0; margin: 0 0 8px; }
.subtitle { color: #909399; font-size: 13px; margin: 0; }
.login-tabs :deep(.el-tabs__item) { font-size: 15px; }
.login-btn { width: 100%; margin-top: 8px; }
.mb-16 { margin-bottom: 16px; }
.demo-accounts { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #ebeef5; }
.demo-title { font-size: 12px; color: #909399; margin: 0 0 8px; }
.demo-tag { cursor: pointer; }
.footer { color: rgba(255, 255, 255, 0.85); font-size: 12px; margin-top: 16px; }

@media (max-width: 480px) {
  .login-box { padding: 20px; }
  .login-header h1 { font-size: 18px; }
}
</style>
