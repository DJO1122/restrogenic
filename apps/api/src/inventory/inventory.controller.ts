import { Controller, Get, Post, Put, Body, Param, Request, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Get('stock')
  getStock(@Request() req: any) {
    return this.inventory.getStock(req.user.branchId);
  }

  @Get('stock/low')
  getLowStock(@Request() req: any) {
    return this.inventory.getLowStockItems(req.user.branchId);
  }

  @Post('stock')
  addStock(@Request() req: any, @Body() body: any) {
    return this.inventory.addStock(req.user.branchId, body);
  }

  @Put('stock/:id')
  updateStock(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.inventory.updateStock(req.user.branchId, id, body);
  }

  @Post('stock/:id/transaction')
  recordTransaction(@Request() req: any, @Param('id') stockItemId: string, @Body() body: any) {
    return this.inventory.addStockTransaction(req.user.branchId, stockItemId, body);
  }

  @Get('suppliers')
  getSuppliers(@Request() req: any) {
    return this.inventory.getSuppliers(req.user.restaurantId);
  }

  @Post('suppliers')
  addSupplier(@Request() req: any, @Body() body: any) {
    return this.inventory.addSupplier(req.user.restaurantId, body);
  }

  @Post('purchase-orders')
  createPurchaseOrder(@Request() req: any, @Body() body: any) {
    return this.inventory.createPurchaseOrder(req.user.branchId, body);
  }

  @Put('purchase-orders/:id/receive')
  receivePurchaseOrder(@Request() req: any, @Param('id') id: string) {
    return this.inventory.receivePurchaseOrder(req.user.branchId, id);
  }
}
