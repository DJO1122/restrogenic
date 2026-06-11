import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-branch')
  handleJoinBranch(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    client.join(`branch:${branchId}`);
    return { event: 'joined', branchId };
  }

  @SubscribeMessage('join-kitchen')
  handleJoinKitchen(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    client.join(`kitchen:${branchId}`);
    return { event: 'joined-kitchen', branchId };
  }

  emitOrderCreated(branchId: string, order: any) {
    this.server.to(`branch:${branchId}`).emit('order:created', order);
    this.server.to(`kitchen:${branchId}`).emit('order:new', order);
  }

  emitOrderUpdated(branchId: string, order: any) {
    this.server.to(`branch:${branchId}`).emit('order:updated', order);
    this.server.to(`kitchen:${branchId}`).emit('order:updated', order);
  }

  emitTableUpdated(branchId: string, table: any) {
    this.server.to(`branch:${branchId}`).emit('table:updated', table);
  }

  emitLowStockAlert(branchId: string, item: any) {
    this.server.to(`branch:${branchId}`).emit('stock:low', item);
  }
}
