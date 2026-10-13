<template>
  <div class="redirect">跳转中...</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

onMounted(() => {
  if (!auth.isLoggedIn) {
    router.push('/login');
    return;
  }
  if (auth.isStudent) router.push('/student/dashboard');
  else router.push('/mentor/dashboard');
});
</script>
