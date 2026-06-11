import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class PinLoginDto {
  @IsString()
  pin: string;

  @IsString()
  @IsOptional()
  restaurantId?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
