// 本地枚举定义(SQLite 不支持 Prisma enum,故在此定义)

export enum UserRole {
  STUDENT = 'STUDENT',
  COUNSELOR = 'COUNSELOR',
  MAJOR_MENTOR = 'MAJOR_MENTOR',
  ACADEMIC_ADMIN = 'ACADEMIC_ADMIN',
  SYS_ADMIN = 'SYS_ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum StudyStage {
  NOT_STARTED = 'NOT_STARTED',
  FOUNDATION = 'FOUNDATION',
  STRENGTHEN = 'STRENGTHEN',
  SPRINT = 'SPRINT',
  EXAM = 'EXAM',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum SchoolTier {
  TIER_985 = '985',
  TIER_211 = '211',
  DOUBLE_FIRST_CLASS = 'DOUBLE_FIRST_CLASS',
  ORDINARY = 'ORDINARY',
}

export enum CheckInStatus {
  NORMAL = 'NORMAL',
  LATE = 'LATE',
  MAKEUP = 'MAKEUP',
  ABSENT = 'ABSENT',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum HelpType {
  ACADEMIC = 'ACADEMIC',
  PSYCHOLOGICAL = 'PSYCHOLOGICAL',
  LIFE = 'LIFE',
  EMPLOYMENT = 'EMPLOYMENT',
}

export enum HelpStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum AlertType {
  CHECKIN_MISSING = 'CHECKIN_MISSING',
  STAGE_STUCK = 'STAGE_STUCK',
  SCORE_DECLINE = 'SCORE_DECLINE',
  HELP_REQUEST = 'HELP_REQUEST',
}

export enum AlertStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
}

export enum ResourceType {
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  LINK = 'LINK',
  OTHER = 'OTHER',
}

export enum ResourceStatus {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

export enum CheckInPeriod {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
}
