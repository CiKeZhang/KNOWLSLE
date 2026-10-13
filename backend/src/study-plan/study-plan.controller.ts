import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudyPlanService } from './study-plan.service';
import { UpdatePlanDto, ToggleTaskDto } from './dto/study-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@ApiTags('备考计划')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly plan: StudyPlanService) {}

  @Get('me/weekly')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:获取/自动生成本周计划' })
  myWeekly(@CurrentUser() user: AuthUser) {
    return this.plan.getMyWeeklyPlan(user.id);
  }

  @Get('me/monthly')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:获取/自动生成本月计划' })
  myMonthly(@CurrentUser() user: AuthUser) {
    return this.plan.getMyMonthlyPlan(user.id);
  }

  @Post('me/regenerate')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:基于当前阶段重新生成本周计划' })
  regenerate(@CurrentUser() user: AuthUser) {
    return this.plan.regenerateWeeklyPlan(user.id);
  }

  @Patch(':id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:手动调整计划任务清单' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plan.updatePlan(user.id, id, dto.tasks, dto.notes);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:勾选任务完成状态' })
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: ToggleTaskDto,
  ) {
    return this.plan.toggleTask(user.id, id, dto.index, dto.done);
  }
}
