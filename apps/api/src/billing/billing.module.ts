import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlatformAuthGuard } from '../admin/platform-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [BillingController],
  providers: [BillingService, PlatformAuthGuard],
})
export class BillingModule {}
