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

/**
 * Envía un mensaje JSON con evento y datos a un socket WebSocket.
 */
function send(ws: WebSocket, event: string, data: any) {
  ws.send(JSON.stringify({ event, data }));
}

/**
 * Gateway WebSocket para la comunicación en tiempo real.
 * Gestiona login de estudiantes, recepción de respuestas,
 * tracking de posición VR y emisión de eventos del juego.
 */
@WebSocketGateway()
export class GamificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private socketIndex = 0;
  private socketIds = new WeakMap<WebSocket, string>();
  private sockets = new Map<string, WebSocket>();
  private clientSessions = new Map<
    WebSocket,
    { studentId: string; sessionId: number }
  >();
  private lastLogTimes = new Map<string, number>();

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

  /** Asigna un ID interno al socket al conectarse. */
  handleConnection(client: WebSocket) {
    const id = this.getId(client);
    console.log(`[SOCKET] Conexion establecida: ID ${id}`);
  }

  /** Libera recursos al desconectarse un socket. */
  handleDisconnect(client: WebSocket) {
    const id = this.getId(client);
    this.gamificationService.removePlayerSocket(id);
    this.sockets.delete(id);
    this.socketIds.delete(client);
    this.clientSessions.delete(client);
    console.log(`[SOCKET] Conexion liberada: ID ${id}`);
  }

  /**
   * Maneja el login de un estudiante vía WebSocket.
   * Registra al estudiante en la sesión, notifica a la sala (STUDENT_JOINED)
   * y sincroniza la pregunta activa si existe.
   */
  @SubscribeMessage('LOGIN_PLAYER')
  async handleLoginPlayer(
    @MessageBody() data: LoginStudentDto,
    @ConnectedSocket() client: WebSocket,
  ) {
    const clientId = this.getId(client);
    console.log(
      `[GATEWAY] LOGIN_PLAYER recibido:`,
      JSON.stringify(data, null, 2),
    );
    this.clientSessions.set(client, {
      studentId: data.studentId,
      sessionId: data.sessionId,
    });
    (client as any).sessionId = data.sessionId;
    (client as any).studentId = data.studentId;
    const registration = this.gamificationService.registerPlayerSocket(
      clientId,
      data,
    );

    console.log(
      `[GATEWAY] Emitiendo STUDENT_JOINED a sesion ${data.sessionId}:`,
      JSON.stringify(
        { studentId: data.studentId, socketId: clientId },
        null,
        2,
      ),
    );
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

  /**
   * Recibe las colocaciones de ítems de un estudiante.
   * - Evalúa la respuesta y retorna resultado inmediato
   * - Notifica a la sala (STUDENT_ANSWERED)
   * - Si todos respondieron, avanza automáticamente a la siguiente pregunta
   */
  @SubscribeMessage('SUBMIT_RESPONSE')
  async handleSubmitResponse(
    @MessageBody()
    data: { placements: Record<number, number>; timestamp: number },
    @ConnectedSocket() client: WebSocket,
  ) {
    const clientId = this.getId(client);
    console.log(
      `[GATEWAY] SUBMIT_RESPONSE recibido de ${clientId}:`,
      JSON.stringify(data, null, 2),
    );
    const response = await this.gamificationService.registerPlayerResponse(
      clientId,
      data.placements,
      data.timestamp,
      'WS',
    );

    if (response.status === 'registered') {
      const playerInfo = this.gamificationService.activePlayers.get(clientId);
      if (playerInfo) {
        console.log(
          `[GATEWAY] Emitiendo STUDENT_ANSWERED a sesion ${playerInfo.sessionId}:`,
          JSON.stringify({ studentId: playerInfo.studentId }, null, 2),
        );
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

  /**
   * Recibe datos de tracking de posición VR (x, y, z) y
   * hace relay (broadcast) a los demás clientes de la misma sesión
   * mediante el evento REMOTE_PLAYER_UPDATE.
   * Throttle de logs: máximo 1 cada 2 segundos por jugador.
   */
  @SubscribeMessage('TRACKING_DATA')
  handleTracking(@ConnectedSocket() client: any, @MessageBody() body: any) {
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        // Ignorar si no es JSON válido
      }
    }

    const data = parsedBody && parsedBody.data ? parsedBody.data : parsedBody;
    if (!data) return;

    const playerId = data.playerId;
    const sessionId = data.sessionId;
    const x = data.x;
    const y = data.y;
    const z = data.z;

    const now = Date.now();
    const lastLog = this.lastLogTimes.get(playerId) || 0;
    if (now - lastLog > 2000) {
      console.log(
        `[GATEWAY] TRACKING_DATA de ${playerId}: ${JSON.stringify({ playerId, sessionId, x, y, z })}`,
      );
      this.lastLogTimes.set(playerId, now);
    }

    this.server.clients.forEach((c: any) => {
      if (
        c !== client &&
        c.readyState === WebSocket.OPEN &&
        c.sessionId === sessionId
      ) {
        c.send(
          JSON.stringify({
            event: 'REMOTE_PLAYER_UPDATE',
            data: {
              playerId: playerId,
              x: x,
              y: y,
              z: z,
            },
          }),
        );
      }
    });
  }

  /** Emite un nuevo ejercicio a todos los sockets de una sesión. */
  emitQuestionToRoom(sessionId: number, questionData: any) {
    console.log(
      `[GATEWAY] Emitiendo NEW_QUESTION_LOADED a sesion ${sessionId}:`,
      JSON.stringify(questionData, null, 2),
    );
    this.sendToSession(sessionId, 'NEW_QUESTION_LOADED', questionData);
  }

  /** Emite un evento genérico a todos los sockets de una sesión. */
  emitToSession(sessionId: number, event: string, data: any) {
    console.log(
      `[GATEWAY] Emitiendo ${event} a sesion ${sessionId}:`,
      JSON.stringify(data, null, 2),
    );
    this.sendToSession(sessionId, event, data);
  }

  /** Emite un evento a un socket específico por su ID. */
  emitToSocket(socketId: string, event: string, data: any) {
    console.log(
      `[GATEWAY] Emitiendo ${event} a socket ${socketId}:`,
      JSON.stringify(data, null, 2),
    );
    this.sendToSocket(socketId, event, data);
  }
}
