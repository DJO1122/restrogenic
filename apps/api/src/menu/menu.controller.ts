import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('menu')
export class MenuController {
  constructor(private menu: MenuService) {}

  @Get('categories')
  getCategories(@Request() req: any) {
    return this.menu.getCategories(req.user.restaurantId);
  }

  @Get('items')
  getItems(@Request() req: any, @Query('category') categoryId?: string, @Query('search') search?: string) {
    return this.menu.getAllItems(req.user.restaurantId, categoryId, search);
  }

  @Post('categories')
  createCategory(@Request() req: any, @Body() dto: CreateCategoryDto) {
    return this.menu.createCategory(req.user.restaurantId, dto);
  }

  @Put('categories/:id')
  updateCategory(@Request() req: any, @Param('id') id: string, @Body() dto: Partial<CreateCategoryDto>) {
    return this.menu.updateCategory(req.user.restaurantId, id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Request() req: any, @Param('id') id: string) {
    return this.menu.deleteCategory(req.user.restaurantId, id);
  }

  @Post('items')
  createItem(@Request() req: any, @Body() dto: CreateMenuItemDto) {
    return this.menu.createItem(req.user.restaurantId, dto);
  }

  @Put('items/:id')
  updateItem(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menu.updateItem(req.user.restaurantId, id, dto);
  }

  @Patch('items/:id/toggle')
  toggleAvailability(@Request() req: any, @Param('id') id: string) {
    return this.menu.toggleAvailability(req.user.restaurantId, id);
  }

  @Delete('items/:id')
  deleteItem(@Request() req: any, @Param('id') id: string) {
    return this.menu.deleteItem(req.user.restaurantId, id);
  }

  @Put('categories/reorder')
  reorderCategories(@Request() req: any, @Body() body: { orderedIds: string[] }) {
    return this.menu.reorderCategories(req.user.restaurantId, body.orderedIds);
  }
}
