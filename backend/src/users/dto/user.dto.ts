import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, Min, Max, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum UserRoleEnum {
  STUDENT = 'STUDENT',
  COUNSELOR = 'COUNSELOR',
  MAJOR_MENTOR = 'MAJOR_MENTOR',
  ACADEMIC_ADMIN = 'ACADEMIC_ADMIN',
  SYS_ADMIN = 'SYS_ADMIN',
}

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRoleEnum })
  @IsEnum(UserRoleEnum)
  role: UserRoleEnum;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  studentNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  staffNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  password?: string; // 不传则使用默认: 用户名 + @2026

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  departmentId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  majorId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  classId?: number;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, enum: UserRoleEnum })
  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRoleEnum;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  majorId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  classId?: number;

  @ApiProperty({ required: false, enum: ['ACTIVE', 'DISABLED', 'PENDING'] })
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'DISABLED' | 'PENDING';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  resetPassword?: boolean;
}

export class ListUsersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiProperty({ required: false, enum: UserRoleEnum })
  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRoleEnum;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  departmentId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  majorId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  classId?: number;
}

export class BatchImportItemDto {
  @IsString()
  username: string;

  @IsString()
  name: string;

  @IsEnum(UserRoleEnum)
  role: UserRoleEnum;

  @IsOptional()
  @IsString()
  studentNo?: string;

  @IsOptional()
  @IsString()
  staffNo?: string;

  @IsOptional()
  @IsString()
  majorCode?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class BatchImportDto {
  @IsArray()
  items: BatchImportItemDto[];
}
