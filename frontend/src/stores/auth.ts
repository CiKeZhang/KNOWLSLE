import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { AuthApi, MentorSelectionApi } from '@/api';

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
  phone?: string;
  mentorId?: number;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('kygl_token') || '');
  const user = ref<UserInfo | null>(
    JSON.parse(localStorage.getItem('kygl_user') || 'null'),
  );
  // null = 尚未查询过是否已选导师
  const mentorSelected = ref<boolean | null>(null);

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

  /** 查询一次并缓存「是否已选导师」。接口异常时放行,避免后端故障把学生卡在引导页。 */
  async function ensureMentorSelected(): Promise<boolean> {
    if (mentorSelected.value !== null) return mentorSelected.value;
    try {
      const mine: any = await MentorSelectionApi.myMentor();
      mentorSelected.value = !!mine;
    } catch (err) {
      console.warn('[auth] 查询导师状态失败,本次放行', err);
      mentorSelected.value = true;
    }
    return mentorSelected.value;
  }

  function setMentorSelected(value: boolean) {
    mentorSelected.value = value;
    if (value) sessionStorage.removeItem('kygl_skip_mentor');
  }

  async function login(username: string, password: string) {
    const res: any = await AuthApi.login(username, password);
    token.value = res.accessToken;
    user.value = res.user;
    mentorSelected.value = null;
    sessionStorage.removeItem('kygl_skip_mentor');
    localStorage.setItem('kygl_token', res.accessToken);
    localStorage.setItem('kygl_user', JSON.stringify(res.user));
    return res;
  }

  function logout() {
    token.value = '';
    user.value = null;
    mentorSelected.value = null;
    localStorage.removeItem('kygl_token');
    localStorage.removeItem('kygl_user');
    sessionStorage.removeItem('kygl_skip_mentor');
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
    mentorSelected,
    ensureMentorSelected,
    setMentorSelected,
    login,
    logout,
    refreshProfile,
  };
});
