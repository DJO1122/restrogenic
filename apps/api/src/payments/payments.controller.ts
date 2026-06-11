import { Controller, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('orders/:id/pay')
  processPayment(@Request() req: any, @Param('id') id: string, @Body() body: { payments: any[] }) {
    return this.payments.processPayment(req.user.branchId, id, body.payments);
  }

  @Post('orders/:id/refund')
  refund(@Request() req: any, @Param('id') id: string, @Body() body: { reason: string; amount?: number }) {
    return this.payments.refund(req.user.branchId, id, body.reason, body.amount);
  }
}
