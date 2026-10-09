import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { UpdateArchiveDto, UpdateStageDto, UpdateProfileDto } from './dto/progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@ApiTags('进度档案')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:我的考研档案(含时间线)' })
  myArchive(@CurrentUser() user: AuthUser) {
    return this.progress.getMyArchive(user.id);
  }

  @Patch('me/archive')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:更新档案详情(目标院校/专业/进度/初试分)' })
  updateArchive(@CurrentUser() user: AuthUser, @Body() dto: UpdateArchiveDto) {
    return this.progress.updateMyArchive(user.id, dto);
  }

  @Patch('me/profile')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:更新个人背景(AI推荐输入维度)' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.progress.updateMyProfile(user.id, dto);
  }

  @Patch('me/stage')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:切换当前阶段(写入历史轨迹)' })
  updateStage(@CurrentUser() user: AuthUser, @Body() dto: UpdateStageDto) {
    return this.progress.updateMyStage(user.id, dto);
  }

  @Get('key-nodes')
  @ApiOperation({ summary: '考研关键节点提醒时间表' })
  keyNodes() {
    return this.progress.getKeyNodes();
  }

  @Get('student/:id')
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '导师端:学生完整档案(档案+历史+打卡+AI+帮扶)' })
  studentArchive(@Param('id', ParseIntPipe) id: number) {
    return this.progress.getStudentArchive(id);
  }
}
