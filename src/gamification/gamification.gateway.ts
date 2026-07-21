import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { WebSocket, Server } from 'ws';
import { GamificationService } from './gamification.service';
import { LoginStudentDto } from './dto/game.dto';
import { Inject, forwardRef } from '@nestjs/common';
import { ContentService } from '../content/content.service';

function send(ws: WebSocket, event: string, data: any) {
  ws.send(JSON.stringify({ event, data }));
}

@WebSocketGateway()
export class GamificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private socketIndex = 0;
  private socketIds = new WeakMap<WebSocket, string>();
  private sockets = new Map<string, WebSocket>();

  constructor(
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService: GamificationService,
    private readonly contentService: ContentService,
  ) {}

  private getId(ws: WebSocket): string {
    let id = this.socketIds.get(ws);
    if (!id) {
      id = `s_${++this.socketIndex}`;
      this.socketIds.set(ws, id);
      this.sockets.set(id, ws);
    }
    return id;
  }

  private sendToSession(sessionId: number, event: string, data: any) {
    const message = JSON.stringify({ event, data });
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const id = this.socketIds.get(client);
        const player = id
          ? this.gamificationService.activePlayers.get(id)
          : undefined;
        if (player && player.sessionId === sessionId) {
          client.send(message);
        }
      }
    });
  }

  private sendToSocket(socketId: string, event: string, data: any) {
    const ws = this.sockets.get(socketId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      send(ws, event, data);
    }
  }

  handleConnection(client: WebSocket) {
    const id = this.getId(client);
    console.log(`[SOCKET] Conexion establecida: ID ${id}`);
  }

  handleDisconnect(client: WebSocket) {
    const id = this.getId(client);
    this.gamificationService.removePlayerSocket(id);
    this.sockets.delete(id);
    this.socketIds.delete(client);
    console.log(`[SOCKET] Conexion liberada: ID ${id}`);
  }

  @SubscribeMessage('LOGIN_PLAYER')
  async handleLoginPlayer(
    @MessageBody() data: LoginStudentDto,
    @ConnectedSocket() client: WebSocket,
  ) {
    const clientId = this.getId(client);
    console.log(`[GATEWAY] LOGIN_PLAYER recibido:`, JSON.stringify(data, null, 2));
    const registration = this.gamificationService.registerPlayerSocket(
      clientId,
      data,
    );

    console.log(`[GATEWAY] Emitiendo STUDENT_JOINED a sesion ${data.sessionId}:`, JSON.stringify({ studentId: data.studentId, socketId: clientId }, null, 2));
    this.sendToSession(data.sessionId, 'STUDENT_JOINED', {
      studentId: data.studentId,
      socketId: clientId,
    });

    if (
      this.gamificationService.isQuestionActive &&
      this.gamificationService.currentExerciseId
    ) {
      try {
        const exercise = await this.contentService.getExerciseById(
          this.gamificationService.currentExerciseId,
        );
        const items: any[] = (exercise as any).items || [];
        send(client, 'NEW_QUESTION_LOADED', {
          exerciseId: this.gamificationService.currentExerciseId,
          title: exercise.title,
          timeLimitSeconds: this.gamificationService.timePerQuestion,
          categories: exercise.categories.map((c) => ({
            id: c.id,
            name: c.name,
          })),
          items: items.map((i) => ({ id: i.id, textContent: i.textContent })),
        });
      } catch (e) {
        console.error('Fallo en sincronizacion inicial', e);
      }
    }

    return registration;
  }

  @SubscribeMessage('SUBMIT_RESPONSE')
  async handleSubmitResponse(
    @MessageBody()
    data: { placements: Record<number, number>; timestamp: number },
    @ConnectedSocket() client: WebSocket,
  ) {
    const clientId = this.getId(client);
    console.log(`[GATEWAY] SUBMIT_RESPONSE recibido de ${clientId}:`, JSON.stringify(data, null, 2));
    const response = await this.gamificationService.registerPlayerResponse(
      clientId,
      data.placements,
      data.timestamp,
      'WS',
    );

    if (response.status === 'registered') {
      const playerInfo = this.gamificationService.activePlayers.get(clientId);
      if (playerInfo) {
        console.log(`[GATEWAY] Emitiendo STUDENT_ANSWERED a sesion ${playerInfo.sessionId}:`, JSON.stringify({ studentId: playerInfo.studentId }, null, 2));
        this.sendToSession(playerInfo.sessionId, 'STUDENT_ANSWERED', {
          studentId: playerInfo.studentId,
        });

        const studentCount = this.gamificationService.getStudentCountForSession(
          playerInfo.sessionId,
        );
        if (
          studentCount > 0 &&
          this.gamificationService.getRespondedCount() >= studentCount &&
          !this.gamificationService.isAdvancing
        ) {
          this.gamificationService.isAdvancing = true;
          try {
            const result =
              await this.gamificationService.advanceToNextQuestionInQueue();
            this.sendToSession(playerInfo.sessionId, 'ROUND_ADVANCED', result);
          } finally {
            this.gamificationService.isAdvancing = false;
          }
        }
      }
    }
    return response;
  }

  @SubscribeMessage('TRACKING_DATA')
  handleTrackingData(@MessageBody() data: any) {
    console.log(`[GATEWAY] TRACKING_DATA recibido:`, JSON.stringify(data, null, 2));
    return;
  }

  emitQuestionToRoom(sessionId: number, questionData: any) {
    console.log(`[GATEWAY] Emitiendo NEW_QUESTION_LOADED a sesion ${sessionId}:`, JSON.stringify(questionData, null, 2));
    this.sendToSession(sessionId, 'NEW_QUESTION_LOADED', questionData);
  }

  emitToSession(sessionId: number, event: string, data: any) {
    console.log(`[GATEWAY] Emitiendo ${event} a sesion ${sessionId}:`, JSON.stringify(data, null, 2));
    this.sendToSession(sessionId, event, data);
  }

  emitToSocket(socketId: string, event: string, data: any) {
    console.log(`[GATEWAY] Emitiendo ${event} a socket ${socketId}:`, JSON.stringify(data, null, 2));
    this.sendToSocket(socketId, event, data);
  }
}
