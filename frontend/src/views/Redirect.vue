<template>
  <div class="redirect">跳转中...</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  if (!auth.isLoggedIn) {
    router.replace('/login');
    return;
  }
  const target = auth.isStudent ? '/student/dashboard' : '/mentor/dashboard';
  router.replace(target).catch(() => undefined);
  // 兜底:若路由切换被并发导航打断,仍在 1 秒后强制回首页
  fallbackTimer = setTimeout(() => {
    if (route.path === '/redirect') router.replace(target).catch(() => undefined);
  }, 1000);
});

onUnmounted(() => {
  if (fallbackTimer) clearTimeout(fallbackTimer);
});
</script>
