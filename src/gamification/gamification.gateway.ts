import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamificationService } from './gamification.service';
import { LoginStudentDto } from './dto/game.dto';
import { Inject, forwardRef } from '@nestjs/common';
import { ContentService } from '../content/content.service';

@WebSocketGateway({
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
})
export class GamificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService: GamificationService,
    private readonly contentService: ContentService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`[SOCKET] Conexion establecida: ID ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.gamificationService.removePlayerSocket(client.id);
    console.log(`[SOCKET] Conexion liberada: ID ${client.id}`);
  }

  @SubscribeMessage('LOGIN_PLAYER')
  async handleLoginPlayer(
    @MessageBody() data: LoginStudentDto,
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(`session_${data.sessionId}`);

    this.server.to(`session_${data.sessionId}`).emit('STUDENT_JOINED', {
      studentId: data.studentId,
      socketId: client.id,
    });

    const registration = this.gamificationService.registerPlayerSocket(
      client.id,
      data,
    );

    if (
      this.gamificationService.isQuestionActive &&
      this.gamificationService.currentExerciseId
    ) {
      try {
        const exercise = await this.contentService.getExerciseById(
          this.gamificationService.currentExerciseId,
        );
        const items: any[] = (exercise as any).items || [];
        client.emit('NEW_QUESTION_LOADED', {
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
    @ConnectedSocket() client: Socket,
  ) {
    const response = await this.gamificationService.registerPlayerResponse(
      client.id,
      data.placements,
      data.timestamp,
    );

    if (response.status === 'registered') {
      const playerInfo = this.gamificationService.activePlayers.get(client.id);
      if (playerInfo) {
        this.server
          .to(`session_${playerInfo.sessionId}`)
          .emit('STUDENT_ANSWERED', {
            studentId: playerInfo.studentId,
          });

        // Auto-advance when all students have responded
        const studentCount = this.gamificationService.getStudentCountForSession(
          playerInfo.sessionId,
        );
        if (
          studentCount > 0 &&
          this.gamificationService.getRespondedCount() >= studentCount &&
          !this.gamificationService['isAdvancing']
        ) {
          this.gamificationService['isAdvancing'] = true;
          try {
            const result =
              await this.gamificationService.advanceToNextQuestionInQueue();
            this.server
              .to(`session_${playerInfo.sessionId}`)
              .emit('ROUND_ADVANCED', result);
          } finally {
            this.gamificationService['isAdvancing'] = false;
          }
        }
      }
    }
    return response;
  }

  @SubscribeMessage('TRACKING_DATA')
  handleTrackingData(@MessageBody() data: any) {
    return;
  }

  emitQuestionToRoom(sessionId: number, questionData: any) {
    this.server
      .to(`session_${sessionId}`)
      .emit('NEW_QUESTION_LOADED', questionData);
  }
}
