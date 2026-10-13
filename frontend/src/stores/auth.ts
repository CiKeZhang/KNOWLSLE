import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { AuthApi } from '@/api';

export interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
  studentNo?: string;
  staffNo?: string;
  departmentId?: number;
  majorId?: number;
  classId?: number;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('kygl_token') || '');
  const user = ref<UserInfo | null>(
    JSON.parse(localStorage.getItem('kygl_user') || 'null'),
  );

  const isLoggedIn = computed(() => !!token.value);
  const role = computed(() => user.value?.role || '');
  const isStudent = computed(() => role.value === 'STUDENT');
  const isCounselor = computed(() => role.value === 'COUNSELOR');
  const isMajorMentor = computed(() => role.value === 'MAJOR_MENTOR');
  const isAcademicAdmin = computed(() => role.value === 'ACADEMIC_ADMIN');
  const isSysAdmin = computed(() => role.value === 'SYS_ADMIN');
  const isMentorSide = computed(() =>
    ['COUNSELOR', 'MAJOR_MENTOR', 'ACADEMIC_ADMIN', 'SYS_ADMIN'].includes(role.value),
  );

  async function login(username: string, password: string) {
    const res: any = await AuthApi.login(username, password);
    token.value = res.accessToken;
    user.value = res.user;
    localStorage.setItem('kygl_token', res.accessToken);
    localStorage.setItem('kygl_user', JSON.stringify(res.user));
    return res;
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('kygl_token');
    localStorage.removeItem('kygl_user');
  }

  async function refreshProfile() {
    const res: any = await AuthApi.profile();
    // profile 接口返回完整 user,只更新基础信息
    if (user.value) {
      user.value.name = res.name;
      user.value.phone = res.phone;
      localStorage.setItem('kygl_user', JSON.stringify(user.value));
    }
    return res;
  }

  return {
    token,
    user,
    isLoggedIn,
    role,
    isStudent,
    isCounselor,
    isMajorMentor,
    isAcademicAdmin,
    isSysAdmin,
    isMentorSide,
    login,
    logout,
    refreshProfile,
  };
});
