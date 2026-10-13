import { Body, Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { WechatAuthService } from './wechat-auth.service';
import { LoginDto, ChangePasswordDto, BootstrapAdminDto } from './dto/auth.dto';
import { WechatLoginDto, WechatPhoneDto, WechatCompleteDto } from './dto/wechat.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('认证')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly wechat: WechatAuthService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户登录(账号密码,导师/管理员使用)' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto.username, dto.password, req?.ip);
  }

  // ============ 微信小程序登录(学生端) ============

  @Public()
  @Post('wechat/login')
  @ApiOperation({ summary: '微信小程序-第一步:wx.login 换取 openid' })
  async wechatLogin(@Body() dto: WechatLoginDto) {
    // 只返回 openid,session_key 属于敏感信息,不返回前端
    const result = await this.wechat.code2Session(dto.code);
    return { openid: result.openid };
  }

  @Public()
  @Post('wechat/phone')
  @ApiOperation({ summary: '微信小程序-第二步:获取手机号' })
  wechatPhone(@Body() dto: WechatPhoneDto) {
    return this.wechat.getPhoneNumber(dto.code);
  }

  @Public()
  @Post('wechat/complete')
  @ApiOperation({ summary: '微信小程序-第三步:补全姓名+学号,完成登录/注册' })
  wechatComplete(@Body() dto: WechatCompleteDto) {
    return this.wechat.completeLogin(dto);
  }

  @Public()
  @Post('bootstrap-admin')
  @ApiOperation({ summary: '初始化系统首个管理员(仅当无管理员时可用,用于首次部署)' })
  bootstrap(@Body() dto: BootstrapAdminDto) {
    return this.auth.bootstrapAdmin(dto.username, dto.password, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: '获取当前用户档案' })
  profile(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: '修改密码' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto.oldPassword, dto.newPassword);
  }
}
