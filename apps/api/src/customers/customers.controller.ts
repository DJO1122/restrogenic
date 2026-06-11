import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  findAll(@Request() req: any, @Query('search') search?: string) {
    return this.customers.findAll(req.user.restaurantId, search);
  }

  @Get('lookup')
  lookup(@Request() req: any, @Query('phone') phone: string) {
    return this.customers.findByPhone(phone, req.user.restaurantId);
  }

  @Post()
  findOrCreate(@Request() req: any, @Body() body: { phone: string; name?: string }) {
    return this.customers.findOrCreate({ ...body, restaurantId: req.user.restaurantId });
  }

  @Post(':id/redeem')
  redeemPoints(@Param('id') id: string, @Body() body: { points: number }) {
    return this.customers.redeemPoints(id, body.points);
  }
}
