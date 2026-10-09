import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HelpService } from './help.service';
import { ApplyHelpDto, ApplyFromCheckInDto } from './dto/help.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole, HelpType } from '../common/enums';

@ApiTags('学业帮扶')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('help')
export class HelpController {
  constructor(private readonly help: HelpService) {}

  @Post('apply')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:提交帮扶申请(择校/单科/心态/复试)' })
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyHelpDto) {
    return this.help.apply(
      user.id,
      dto.type as HelpType,
      dto.content,
      dto.preferredRole as UserRole | undefined,
    );
  }

  @Post('apply-from-checkin')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:从打卡困难一键转化为帮扶申请(无需重复填写)' })
  applyFromCheckIn(@CurrentUser() user: AuthUser, @Body() dto: ApplyFromCheckInDto) {
    return this.help.applyFromCheckIn(
      user.id,
      dto.checkInId,
      (dto.type as HelpType) ?? HelpType.OTHER,
      dto.extraContent,
    );
  }

  @Get('me/applications')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:我的帮扶申请列表(含对接安排与回复)' })
  myApplications(@CurrentUser() user: AuthUser) {
    return this.help.myApplications(user.id);
  }

  @Get('applications/:id')
  @ApiOperation({ summary: '查看帮扶申请详情' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    // 学生只能看自己的;导师/管理员可看全部
    if (user.role === UserRole.STUDENT) {
      return this.help.detail(id, user.id);
    }
    return this.help.detail(id);
  }
}
