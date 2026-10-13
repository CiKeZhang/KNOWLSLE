import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole, ResourceType, ResourceStatus, StudyStage } from '../common/enums';

class CreateResourceDto {
  type: ResourceType;
  title: string;
  description?: string;
  url?: string;
  filePath?: string;
  stage?: StudyStage;
  majorName?: string;
}

@ApiTags('备考资源库')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: '浏览已审核资源(分专业、分阶段,学生可见)' })
  list(
    @Query('type') type?: ResourceType,
    @Query('stage') stage?: StudyStage,
    @Query('majorName') majorName?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.resources.list({
      type,
      stage,
      majorName,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '查看资源详情(自增浏览数)' })
  view(@Param('id', ParseIntPipe) id: number) {
    return this.resources.view(id);
  }

  @Post()
  @Roles(UserRole.COUNSELOR, UserRole.MAJOR_MENTOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '上传备考资源(需审核通过后学生可见)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateResourceDto) {
    return this.resources.create(dto, user.id);
  }

  @Patch(':id/review')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '审核资源(APPROVED/REJECTED/OFFLINE)' })
  review(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body('status') status: ResourceStatus,
  ) {
    return this.resources.review(id, status, user.id);
  }

  @Patch(':id/offline')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '下架资源' })
  offline(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.resources.offline(id, user.id);
  }

  @Get('admin/pending-review')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '后台:待审核资源列表' })
  pendingReview() {
    return this.resources.listForReview();
  }
}
