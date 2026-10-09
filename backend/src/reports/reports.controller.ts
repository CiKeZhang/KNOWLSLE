import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@ApiTags('报表与导出')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN, UserRole.COUNSELOR, UserRole.MAJOR_MENTOR)
  @ApiOperation({ summary: '学院考研工作报表(参与率/阶段分布/打卡完成率/上岸情况)' })
  summary(
    @Query('departmentId') departmentId?: string,
    @Query('majorId') majorId?: string,
    @Query('classId') classId?: string,
    @Query('semester') semester?: string,
    @Query('month') month?: string,
  ) {
    return this.reports.summary({
      departmentId: departmentId ? Number(departmentId) : undefined,
      majorId: majorId ? Number(majorId) : undefined,
      classId: classId ? Number(classId) : undefined,
      semester,
      month,
    });
  }

  @Get('export/checkin-excel')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN, UserRole.COUNSELOR, UserRole.MAJOR_MENTOR)
  @ApiOperation({ summary: '导出周度打卡统计表 Excel' })
  async exportCheckinExcel(
    @Res() res: Response,
    @Query('departmentId') departmentId?: string,
    @Query('majorId') majorId?: string,
    @Query('classId') classId?: string,
    @Query('weekStart') weekStart?: string,
  ) {
    const result = await this.reports.exportCheckinExcel({
      departmentId: departmentId ? Number(departmentId) : undefined,
      majorId: majorId ? Number(majorId) : undefined,
      classId: classId ? Number(classId) : undefined,
      weekStart: weekStart ? new Date(weekStart) : undefined,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.buffer);
  }

  @Get('export/progress-pdf')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN, UserRole.COUNSELOR, UserRole.MAJOR_MENTOR)
  @ApiOperation({ summary: '导出进度汇总表 PDF' })
  async exportProgressPdf(
    @Res() res: Response,
    @Query('departmentId') departmentId?: string,
    @Query('majorId') majorId?: string,
    @Query('classId') classId?: string,
  ) {
    const result = await this.reports.exportProgressPdf({
      departmentId: departmentId ? Number(departmentId) : undefined,
      majorId: majorId ? Number(majorId) : undefined,
      classId: classId ? Number(classId) : undefined,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.buffer);
  }

  @Get('checkin-analysis')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '全院打卡数据分析(支持按学期/月份,可导出)' })
  checkinAnalysis(
    @Query('semester') semester?: string,
    @Query('month') month?: string,
  ) {
    return this.reports.checkinAnalysis({ semester, month });
  }
}
