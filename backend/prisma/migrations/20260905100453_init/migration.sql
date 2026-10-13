-- CreateTable
CREATE TABLE "department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "major" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "major_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "majorId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "counselorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "major" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentNo" TEXT,
    "staffNo" TEXT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "wechatOpenId" TEXT,
    "wechatUnionId" TEXT,
    "wechatNickname" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "departmentId" INTEGER,
    "majorId" INTEGER,
    "classId" INTEGER,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "major" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "undergraduateMajor" TEXT,
    "gpa" DECIMAL,
    "majorRank" TEXT,
    "region" TEXT,
    "schoolTierPref" TEXT,
    "strongSubjects" TEXT,
    "weakSubjects" TEXT,
    "careerIntention" TEXT,
    "enterYear" INTEGER,
    "currentStage" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "remainingMonths" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "student_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "checkin_rule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "period" TEXT NOT NULL DEFAULT 'WEEKLY',
    "weekStartDay" INTEGER NOT NULL DEFAULT 1,
    "startAt" TEXT NOT NULL DEFAULT '00:00',
    "endAt" TEXT NOT NULL DEFAULT '23:59',
    "fridayRemindAt" TEXT NOT NULL DEFAULT '18:00',
    "sundayAlertAt" TEXT NOT NULL DEFAULT '20:00',
    "requireStage" BOOLEAN NOT NULL DEFAULT true,
    "requireCompletedItems" BOOLEAN NOT NULL DEFAULT true,
    "requireDifficulties" BOOLEAN NOT NULL DEFAULT true,
    "makeupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "makeupValidDays" INTEGER NOT NULL DEFAULT 3,
    "makeupApproverRole" TEXT NOT NULL DEFAULT 'COUNSELOR',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "checkin_record" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "stage" TEXT,
    "completedItems" TEXT,
    "difficulties" TEXT,
    "studyHours" DECIMAL,
    "mockScore" TEXT,
    "progressPublic" DECIMAL,
    "progressMajor" DECIMAL,
    "targetSchoolChanged" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'regular',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "checkin_record_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "makeup_checkin_application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" INTEGER,
    "approverComment" TEXT,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "makeup_checkin_application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "makeup_checkin_application_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_archive" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "targetSchoolId" INTEGER,
    "targetSchoolName" TEXT,
    "targetMajor" TEXT,
    "publicCourseProgress" DECIMAL NOT NULL DEFAULT 0,
    "majorCourseProgress" DECIMAL NOT NULL DEFAULT 0,
    "mockScores" TEXT,
    "examTotal" INTEGER,
    "examPolitics" INTEGER,
    "examEnglish" INTEGER,
    "examMath" INTEGER,
    "examMajor" INTEGER,
    "reexamProgress" DECIMAL,
    "adjustmentProgress" TEXT,
    "finalResult" TEXT,
    "finalSchool" TEXT,
    "stageHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "progress_archive_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "progress_history_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "school" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "tier" TEXT NOT NULL,
    "region" TEXT,
    "province" TEXT,
    "city" TEXT,
    "is985" BOOLEAN NOT NULL DEFAULT false,
    "is211" BOOLEAN NOT NULL DEFAULT false,
    "isDoubleFirst" BOOLEAN NOT NULL DEFAULT false,
    "priorityWeight" DECIMAL DEFAULT 1,
    "logoUrl" TEXT,
    "website" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "major_program" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schoolId" INTEGER NOT NULL,
    "majorName" TEXT NOT NULL,
    "majorCode" TEXT,
    "reportRatio2023" DECIMAL,
    "reportRatio2024" DECIMAL,
    "reportRatio2025" DECIMAL,
    "reexamLine2023" INTEGER,
    "reexamLine2024" INTEGER,
    "reexamLine2025" INTEGER,
    "enrollCount2023" INTEGER,
    "enrollCount2024" INTEGER,
    "enrollCount2025" INTEGER,
    "exemptRatio" DECIMAL,
    "examSubjects" TEXT,
    "isCollegeAligned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "major_program_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_recommendation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "inputParams" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "llmSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_recommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_recommendation_feedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recommendationId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "itemId" TEXT,
    "comment" TEXT NOT NULL,
    "adjustment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_recommendation_feedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ai_recommendation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "stage" TEXT,
    "majorName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "filePath" TEXT,
    "uploaderId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "resource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "study_plan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "monthKey" TEXT,
    "weekKey" TEXT,
    "tasks" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "study_plan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "help_application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "preferredRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigneeId" INTEGER,
    "fromCheckInId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "help_application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "help_application_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "help_record" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicationId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "effect" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "help_record_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "help_application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "help_record_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "handledBy" INTEGER,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "watched_student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "note" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watched_student_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipientId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "key_node_reminder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nodeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "operation_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "batch_import" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "operatorId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failCount" INTEGER NOT NULL,
    "filePath" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "batch_import_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "department_code_key" ON "department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "major_code_key" ON "major"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_wechatOpenId_key" ON "user"("wechatOpenId");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_departmentId_idx" ON "user"("departmentId");

-- CreateIndex
CREATE INDEX "user_majorId_idx" ON "user"("majorId");

-- CreateIndex
CREATE INDEX "user_classId_idx" ON "user"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_userId_key" ON "student_profile"("userId");

-- CreateIndex
CREATE INDEX "checkin_record_studentId_idx" ON "checkin_record"("studentId");

-- CreateIndex
CREATE INDEX "checkin_record_weekStart_idx" ON "checkin_record"("weekStart");

-- CreateIndex
CREATE INDEX "checkin_record_status_idx" ON "checkin_record"("status");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_record_studentId_weekStart_key" ON "checkin_record"("studentId", "weekStart");

-- CreateIndex
CREATE INDEX "makeup_checkin_application_studentId_idx" ON "makeup_checkin_application"("studentId");

-- CreateIndex
CREATE INDEX "makeup_checkin_application_status_idx" ON "makeup_checkin_application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "progress_archive_studentId_key" ON "progress_archive"("studentId");

-- CreateIndex
CREATE INDEX "progress_history_studentId_idx" ON "progress_history"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "school_name_key" ON "school"("name");

-- CreateIndex
CREATE INDEX "school_tier_idx" ON "school"("tier");

-- CreateIndex
CREATE INDEX "school_region_idx" ON "school"("region");

-- CreateIndex
CREATE INDEX "major_program_schoolId_idx" ON "major_program"("schoolId");

-- CreateIndex
CREATE INDEX "major_program_majorName_idx" ON "major_program"("majorName");

-- CreateIndex
CREATE INDEX "ai_recommendation_studentId_idx" ON "ai_recommendation"("studentId");

-- CreateIndex
CREATE INDEX "resource_type_idx" ON "resource"("type");

-- CreateIndex
CREATE INDEX "resource_stage_idx" ON "resource"("stage");

-- CreateIndex
CREATE INDEX "resource_majorName_idx" ON "resource"("majorName");

-- CreateIndex
CREATE INDEX "resource_status_idx" ON "resource"("status");

-- CreateIndex
CREATE INDEX "study_plan_studentId_idx" ON "study_plan"("studentId");

-- CreateIndex
CREATE INDEX "help_application_studentId_idx" ON "help_application"("studentId");

-- CreateIndex
CREATE INDEX "help_application_status_idx" ON "help_application"("status");

-- CreateIndex
CREATE INDEX "help_application_assigneeId_idx" ON "help_application"("assigneeId");

-- CreateIndex
CREATE INDEX "help_record_applicationId_idx" ON "help_record"("applicationId");

-- CreateIndex
CREATE INDEX "alert_studentId_idx" ON "alert"("studentId");

-- CreateIndex
CREATE INDEX "alert_type_idx" ON "alert"("type");

-- CreateIndex
CREATE INDEX "alert_status_idx" ON "alert"("status");

-- CreateIndex
CREATE UNIQUE INDEX "watched_student_studentId_mentorId_key" ON "watched_student"("studentId", "mentorId");

-- CreateIndex
CREATE INDEX "notification_log_recipientId_idx" ON "notification_log"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "key_node_reminder_nodeKey_key" ON "key_node_reminder"("nodeKey");

-- CreateIndex
CREATE INDEX "operation_log_userId_idx" ON "operation_log"("userId");

-- CreateIndex
CREATE INDEX "operation_log_createdAt_idx" ON "operation_log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");
