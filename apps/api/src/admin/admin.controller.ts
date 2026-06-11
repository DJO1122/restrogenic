import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PlatformAuthGuard } from './platform-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  // Public: platform admin login
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.admin.login(body.email, body.password);
  }

  // ── Everything below requires a platform-admin token ──
  @UseGuards(PlatformAuthGuard)
  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }

  @UseGuards(PlatformAuthGuard)
  @Get('tenants')
  listTenants(@Query() q: { status?: string; shopType?: string; search?: string }) {
    return this.admin.listTenants(q);
  }

  @UseGuards(PlatformAuthGuard)
  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.admin.getTenant(id);
  }

  @UseGuards(PlatformAuthGuard)
  @Post('tenants')
  createTenant(@Body() body: any) {
    return this.admin.createTenant(body);
  }

  @UseGuards(PlatformAuthGuard)
  @Patch('tenants/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.admin.setStatus(id, 'Suspended');
  }

  @UseGuards(PlatformAuthGuard)
  @Patch('tenants/:id/activate')
  activate(@Param('id') id: string) {
    return this.admin.setStatus(id, 'Active');
  }

  @UseGuards(PlatformAuthGuard)
  @Patch('tenants/:id/plan')
  changePlan(@Param('id') id: string, @Body() body: { planId: string }) {
    return this.admin.changePlan(id, body.planId);
  }

  @UseGuards(PlatformAuthGuard)
  @Delete('tenants/:id')
  remove(@Param('id') id: string) {
    return this.admin.deleteTenant(id);
  }

  @UseGuards(PlatformAuthGuard)
  @Get('plans')
  listPlans() {
    return this.admin.listPlans();
  }

  @UseGuards(PlatformAuthGuard)
  @Post('plans')
  createPlan(@Body() body: any) {
    return this.admin.upsertPlan(body);
  }

  @UseGuards(PlatformAuthGuard)
  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.admin.upsertPlan({ ...body, id });
  }

  @UseGuards(PlatformAuthGuard)
  @Get('invoices')
  listInvoices() {
    return this.admin.listInvoices();
  }
}
