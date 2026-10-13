/**
 * 学院固定专业列表(用于注册选择与按专业统计)
 */
export const MAJORS = [
  '信息管理',
  '电子商务',
  '财务管理',
  '经济学',
  '市场营销',
] as const;

export type MajorName = (typeof MAJORS)[number];
