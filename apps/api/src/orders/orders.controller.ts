import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';


@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.branchId, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: { status?: string; date?: string; type?: string }) {
    return this.orders.findAll(req.user.branchId, query);
  }

  @Get('kitchen')
  kitchen(@Request() req: any) {
    return this.orders.getActiveOrdersForKitchen(req.user.branchId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.orders.findOne(req.user.branchId, id);
  }

  @Put(':id/status')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(req.user.branchId, id, dto);
  }

  @Patch(':id/hold')
  holdOrder(@Request() req: any, @Param('id') id: string) {
    return this.orders.holdOrder(req.user.branchId, id);
  }

  @Post(':id/items')
  addItems(@Request() req: any, @Param('id') id: string, @Body() body: { items: any[] }) {
    return this.orders.addItems(req.user.branchId, id, body.items);
  }

  @Delete(':orderId/items/:itemId')
  cancelItem(@Request() req: any, @Param('orderId') orderId: string, @Param('itemId') itemId: string) {
    return this.orders.cancelItem(req.user.branchId, orderId, itemId);
  }

  @Patch(':orderId/items/:itemId/ready')
  markItemReady(@Request() req: any, @Param('orderId') orderId: string, @Param('itemId') itemId: string) {
    return this.orders.markItemReady(req.user.branchId, orderId, itemId);
  }
}
