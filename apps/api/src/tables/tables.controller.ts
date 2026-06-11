import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private tables: TablesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.tables.findAll(req.user.branchId);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.tables.create(req.user.branchId, body);
  }

  @Put('layout')
  updateLayout(@Request() req: any, @Body() body: { tables: any[] }) {
    return this.tables.updateLayout(req.user.branchId, body.tables);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.tables.update(req.user.branchId, id, body);
  }

  @Delete(':id')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.tables.delete(req.user.branchId, id);
  }
}
