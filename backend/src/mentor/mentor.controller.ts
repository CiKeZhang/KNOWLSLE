import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { MentorService } from './mentor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole, HelpType, HelpStatus } from '../common/enums';

class BatchNotifyDto {
  @IsArray()
  studentIds: number[];

  @IsString()
  title: string;

  @IsString()
  content: string;
}

class RecordHelpDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  effect?: string;
}

class WatchDto {
  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags('导师端')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mentor')
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  @Get('dashboard')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '考研进度全景看板(阶段分布/院校层次/打卡率/趋势)' })
  dashboard(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId?: string,
    @Query('majorId') majorId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    // MAJOR_MENTOR 默认按本人专业过滤
    const effMajorId =
      user.role === 'MAJOR_MENTOR' ? (user.majorId ?? (majorId ? Number(majorId) : undefined)) : (majorId ? Number(majorId) : undefined);
    return this.mentor.dashboard({
      mentorId: user.id,
      role: user.role,
      classId: classId ? Number(classId) : undefined,
      majorId: effMajorId,
      departmentId: departmentId ? Number(departmentId) : undefined,
    });
  }

  @Get('students')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '多条件筛选学生列表(支持按打卡状态/阶段/分数段)' })
  listStudents(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId?: string,
    @Query('majorId') majorId?: string,
    @Query('stage') stage?: string,
    @Query('checkinStatus') checkinStatus?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const effMajorId =
      user.role === 'MAJOR_MENTOR' ? (user.majorId ?? (majorId ? Number(majorId) : undefined)) : (majorId ? Number(majorId) : undefined);
    return this.mentor.listStudents({
      mentorId: user.id,
      role: user.role,
      classId: classId ? Number(classId) : undefined,
      majorId: effMajorId,
      stage,
      checkinStatus,
      minScore: minScore ? Number(minScore) : undefined,
      maxScore: maxScore ? Number(maxScore) : undefined,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('alerts')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '异常预警列表(打卡异常/进度异常/状态异常)' })
  alerts(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.mentor.alerts({ mentorId: user.id, role: user.role, status, type });
  }

  @Patch('alerts/:id/handle')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '处理预警(标记已处理)' })
  handleAlert(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.mentor.handleAlert(id, user.id);
  }

  @Post('watch/:studentId')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR)
  @ApiOperation({ summary: '标记重点关注学生' })
  watch(
    @Param('studentId', ParseIntPipe) studentId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: WatchDto,
  ) {
    return this.mentor.watchStudent(studentId, user.id, dto.note);
  }

  @Delete('watch/:studentId')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR)
  @ApiOperation({ summary: '取消重点关注' })
  unwatch(@Param('studentId', ParseIntPipe) studentId: number, @CurrentUser() user: AuthUser) {
    return this.mentor.unwatchStudent(studentId, user.id);
  }

  @Get('watched')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '我的重点关注学生列表' })
  watched(@CurrentUser() user: AuthUser) {
    return this.mentor.listWatched(user.id);
  }

  @Get('help-applications')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '帮扶申请列表(含帮扶记录)' })
  listHelp(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('type') type?: HelpType,
  ) {
    return this.mentor.listHelpApplications({
      mentorId: user.id,
      role: user.role,
      status: status as HelpStatus,
      type,
    });
  }

  @Post('help-applications/:id/assign')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '接受帮扶申请(分配给自己对接)' })
  assignHelp(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.mentor.assignHelp(id, user.id);
  }

  @Post('help-applications/:id/record')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '记录帮扶内容并标记已解决' })
  recordHelp(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordHelpDto,
  ) {
    return this.mentor.recordHelp(id, user.id, dto.content, dto.effect);
  }

  @Post('batch-notify')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '一键批量发送提醒通知(站内信)' })
  batchNotify(@CurrentUser() user: AuthUser, @Body() dto: BatchNotifyDto) {
    return this.mentor.batchNotify(dto.studentIds, dto.title, dto.content, user.id);
  }
}
