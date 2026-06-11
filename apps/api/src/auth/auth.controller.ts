import { Controller, Post, Body, Get, Request, UseGuards, SetMetadata } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, PinLoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const Public = () => SetMetadata('isPublic', true);

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('setup')
  setup(@Body() body: any) {
    return this.auth.setupInitialRestaurant(body);
  }

  // Self-serve signup — a shop creates its own 14-day Trial tenant
  @Public()
  @Post('signup')
  signup(@Body() body: any) {
    return this.auth.signup(body);
  }

  // Public plans for the pricing/signup page
  @Public()
  @Get('plans')
  plans() {
    return this.auth.listPublicPlans();
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('pin-login')
  pinLogin(@Body() dto: PinLoginDto) {
    return this.auth.pinLogin(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return this.auth.getProfile(req.user.id);
  }
}
