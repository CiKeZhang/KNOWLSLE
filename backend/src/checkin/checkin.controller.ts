import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CheckInService } from './checkin.service';
import { SubmitCheckInDto, MakeupApplicationDto, ApproveMakeupDto } from './dto/checkin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@ApiTags('周度打卡')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checkin')
export class CheckInController {
  constructor(private readonly checkin: CheckInService) {}

  @Get('rule')
  @ApiOperation({ summary: '获取打卡规则配置' })
  getRule() {
    return this.checkin.getRule();
  }

  @Get('me/week-status')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:本周打卡状态' })
  myWeekStatus(@CurrentUser() user: AuthUser) {
    return this.checkin.getMyWeekStatus(user.id);
  }

  @Post('me/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:提交本周打卡(必填:阶段、完成事项、困难)' })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitCheckInDto) {
    return this.checkin.submitMyWeek(user.id, dto);
  }

  @Post('me/makeup')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:申请补卡(需说明原因,由辅导员审核)' })
  applyMakeup(@CurrentUser() user: AuthUser, @Body() dto: MakeupApplicationDto) {
    return this.checkin.applyMakeup(user.id, dto);
  }

  @Get('me/history')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:我的打卡日历与历史曲线' })
  myHistory(@CurrentUser() user: AuthUser) {
    return this.checkin.myHistory(user.id);
  }

  // ---------- 导师端 ----------
  @Get('mentor/stats')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '导师端:打卡统计(本周打卡率、连续打卡、趋势)' })
  mentorStats(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId?: string,
    @Query('majorId') majorId?: string,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.checkin.statsForMentor({
      mentorId: user.id,
      role: user.role,
      classId: classId ? Number(classId) : undefined,
      majorId: majorId ? Number(majorId) : undefined,
      weekStart: weekStart ? new Date(weekStart) : undefined,
    });
  }

  @Get('mentor/missing')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '导师端:本周未打卡学生(批量提醒使用)' })
  listMissing(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId?: string,
    @Query('majorId') majorId?: string,
  ) {
    return this.checkin.listMissingThisWeek({
      mentorId: user.id,
      role: user.role,
      classId: classId ? Number(classId) : undefined,
      majorId: majorId ? Number(majorId) : undefined,
    });
  }

  @Get('mentor/makeup-applications')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '导师端:待审批补卡申请列表' })
  listMakeups(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.checkin.listMakeupApplications({
      approverId: user.id,
      role: user.role,
      status,
    });
  }

  @Patch('mentor/makeup-applications/:id/approve')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '导师端:审批补卡申请' })
  approveMakeup(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApproveMakeupDto,
  ) {
    return this.checkin.approveMakeup(id, user.id, dto);
  }

  @Get('student/:id/history')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '导师端:查看某学生打卡历史' })
  studentHistory(@Param('id', ParseIntPipe) id: number) {
    return this.checkin.listByStudent(id);
  }
}
