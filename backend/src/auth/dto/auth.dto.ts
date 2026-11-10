import { IsString, MinLength, MaxLength, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: '用户名/学号/工号' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'admin123', description: '密码' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  oldPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class BootstrapAdminDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  name: string;
}

/** 测试登录:管理员用自己的微信登录后,直接切换到任意学生/导师账号查看(不绑定微信) */
export class TestLoginDto {
  @ApiProperty({ example: '251104050021', description: '学号 / 工号 / 用户名' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  account: string;

  @ApiProperty({ description: '测试登录口令(服务端 TEST_LOGIN_SECRET)' })
  @IsString()
  secret: string;
}
