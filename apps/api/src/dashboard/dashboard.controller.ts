import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('today')
  today(@Request() req: any) {
    return this.dashboard.getTodaySummary(req.user.branchId);
  }

  @Get('trend')
  trend(@Request() req: any) {
    return this.dashboard.getLast30DaysTrend(req.user.branchId);
  }

  @Get('sales')
  sales(@Request() req: any, @Query('from') from: string, @Query('to') to: string) {
    return this.dashboard.getSalesReport(req.user.branchId, from, to);
  }
}
