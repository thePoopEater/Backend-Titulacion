import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSessionEntity } from './entities/game-session.entity';
import { SessionQuestionEntity } from './entities/session-question.entity';
import { ContentService } from '../content/content.service';
import { StatisticsService } from '../statistics/statistics.service';
import {
  CreateSessionDto,
  SetCurrentQuestionDto,
  LoginStudentDto,
  ConfigureRoundDto,
} from './dto/game.dto';
import { GamificationGateway } from './gamification.gateway';
import { LatencyLogEntity } from 'src/statistics/entities/latency-log.entity';

/** Respuesta de un estudiante almacenada en memoria volátil durante la ronda. */
export interface VRResponse {
  playerId: string;
  placements: Record<number, number>;
  clientTimestamp: number;
  arrivalTimestamp: number;
  networkLag: number;
  decisionTime: number;
}

/**
 * Servicio central de gamificación.
 * Gestiona sesiones de juego, rondas, colas de preguntas,
 * registro de respuestas, cálculo de puntajes y mitigación de latencia.
 *
 * El estado del juego activo se mantiene en memoria (volátil):
 * - activeRoundResponses: respuestas de la pregunta actual
 * - activePlayers: mapa socketId -> { studentId, sessionId }
 * - roundQuestionQueue: cola de IDs de ejercicios para la ronda
 */
@Injectable()
export class GamificationService {
  private activeRoundResponses: VRResponse[] = [];
  public activePlayers = new Map<
    string,
    { studentId: string; sessionId: number }
  >();

  public currentSessionId: number | null = null;
  public currentExerciseId: number | null = null;
  public isQuestionActive = false;
  public timePerQuestion = 30;
  private currentExercise: any = null;

  private roundQuestionQueue: number[] = [];
  private roundEndTime: number | null = null;
  private studentSessionStartTimes = new Map<string, number>();
  public isAdvancing = false;

  constructor(
    @InjectRepository(GameSessionEntity)
    private readonly sessionRepository: Repository<GameSessionEntity>,
    @InjectRepository(SessionQuestionEntity)
    private readonly sessionQuestionRepository: Repository<SessionQuestionEntity>,
    private readonly contentService: ContentService,
    @Inject(forwardRef(() => StatisticsService))
    private readonly statisticsService: StatisticsService,
    @Inject(forwardRef(() => GamificationGateway))
    private readonly gamificationGateway: GamificationGateway,
    @InjectRepository(LatencyLogEntity)
    private readonly latencyRepository: Repository<LatencyLogEntity>,
  ) {}

  /**
   * Crea una nueva sesión de juego y la establece como activa.
   * @param dto.name Nombre visible de la sesión
   */
  async createSession(dto: CreateSessionDto): Promise<GameSessionEntity> {
    const session = this.sessionRepository.create({ name: dto.name });
    const savedSession = await this.sessionRepository.save(session);
    this.currentSessionId = savedSession.id;
    return savedSession;
  }

  /** Obtiene todas las sesiones activas (orden descendente por creación). */
  async getActiveSessions(): Promise<GameSessionEntity[]> {
    return await this.sessionRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Obtiene todas las sesiones, activas e inactivas. */
  async getAllSessions(): Promise<GameSessionEntity[]> {
    return await this.sessionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene una sesión por ID, incluyendo los ejercicios
   * parseados desde questionOrder (JSON string).
   */
  async getSessionById(id: number): Promise<any> {
    const session = await this.sessionRepository.findOne({
      where: { id },
    });
    if (!session) throw new NotFoundException(`Sesion ID ${id} no encontrada.`);

    let exercises: any[] = [];
    if (session.questionOrder) {
      const ids: number[] = JSON.parse(session.questionOrder);
      exercises = await Promise.all(
        ids.map(async (qId) => {
          try {
            return await this.contentService.getExerciseById(qId);
          } catch {
            return null;
          }
        }),
      );
      exercises = exercises.filter(Boolean);
    }

    return {
      id: session.id,
      name: session.name,
      isActive: session.isActive,
      questionOrder: session.questionOrder,
      createdAt: session.createdAt,
      exercises,
    };
  }

  /**
   * Asocia un socket WebSocket a un estudiante en una sesión.
   * @returns Estado de login
   */
  registerPlayerSocket(socketId: string, dto: LoginStudentDto) {
    this.activePlayers.set(socketId, {
      studentId: dto.studentId,
      sessionId: dto.sessionId,
    });
    return {
      status: 'logged_in',
      studentId: dto.studentId,
      sessionId: dto.sessionId,
    };
  }

  /** Remueve un socket (desconexión de estudiante). */
  removePlayerSocket(socketId: string) {
    this.activePlayers.delete(socketId);
  }

  /**
   * Configura y arranca una ronda completa.
   * - Establece la cola de IDs de ejercicios
   * - Configura tiempo por pregunta y tiempo total de ronda
   * - Avanza automáticamente al primer ejercicio
   */
  async configureAndStartRound(dto: ConfigureRoundDto) {
    const session = await this.sessionRepository.findOne({
      where: { id: dto.sessionId },
    });
    if (!session)
      throw new NotFoundException(`Sesion ID ${dto.sessionId} no encontrada.`);

    this.currentSessionId = dto.sessionId;
    this.roundQuestionQueue = [...dto.questionIds];
    this.timePerQuestion = dto.timePerQuestionSeconds;
    this.roundEndTime = Date.now() + dto.totalRoundTimeMinutes * 60 * 1000;

    session.questionOrder = JSON.stringify(dto.questionIds);
    await this.sessionRepository.save(session);

    return this.advanceToNextQuestionInQueue();
  }

  /**
   * Avanza al siguiente ejercicio en la cola.
   * Procesa respuestas previas si las hay.
   * Verifica límite de tiempo global de ronda.
   * @returns Estado: question_active, round_ended o round_completed
   */
  async advanceToNextQuestionInQueue() {
    if (this.isQuestionActive && this.activeRoundResponses.length > 0) {
      await this.processRoundResults();
    }

    if (this.roundEndTime && Date.now() > this.roundEndTime) {
      this.isQuestionActive = false;
      this.emitFinalRoundSummary('Ronda finalizada por tiempo');
      return { status: 'round_ended', reason: 'Global round time expired' };
    }

    if (this.roundQuestionQueue.length === 0) {
      this.isQuestionActive = false;
      this.emitFinalRoundSummary('Ronda completada');
      return { status: 'round_completed', reason: 'All exercises processed' };
    }

    const nextExerciseId = this.roundQuestionQueue.shift()!;

    const dto: SetCurrentQuestionDto = {
      sessionId: this.currentSessionId!,
      questionId: nextExerciseId,
    };

    return this.setCurrentQuestionInternal(dto);
  }

  /**
   * Avanza directamente a una pregunta específica (sin cola).
   * Usado por active-question endpoint.
   */
  async advanceToQuestionDirect(dto: SetCurrentQuestionDto) {
    this.currentSessionId = dto.sessionId;
    return this.setCurrentQuestionInternal(dto);
  }

  /**
   * Establece un ejercicio como activo en la sesión.
   * Marca el sessionQuestion como isCurrent, resetea respuestas,
   * y emite NEW_QUESTION_LOADED por WebSocket a todos los estudiantes.
   */
  private async setCurrentQuestionInternal(
    dto: SetCurrentQuestionDto,
  ): Promise<any> {
    const session = await this.sessionRepository.findOne({
      where: { id: dto.sessionId },
    });
    if (!session)
      throw new NotFoundException(`Sesion ID ${dto.sessionId} no encontrada.`);

    const exercise = await this.contentService.getExerciseById(dto.questionId);

    await this.sessionQuestionRepository.update(
      { session: { id: dto.sessionId } },
      { isCurrent: false },
    );

    let sessionQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: dto.sessionId },
        exercise: { id: dto.questionId },
      },
    });

    if (!sessionQuestion) {
      sessionQuestion = this.sessionQuestionRepository.create({
        session,
        exercise,
      });
    }

    sessionQuestion.isCurrent = true;
    sessionQuestion.timeLimitSeconds = this.timePerQuestion;
    sessionQuestion.startedAt = new Date();
    sessionQuestion.endedAt = null;

    await this.sessionQuestionRepository.save(sessionQuestion);

    this.currentExerciseId = dto.questionId;
    this.currentExercise = exercise;
    this.activeRoundResponses = [];
    this.isQuestionActive = true;

    const items = (exercise as any).items || [];

    this.gamificationGateway.emitQuestionToRoom(dto.sessionId, {
      exerciseId: dto.questionId,
      title: exercise.title,
      timeLimitSeconds: this.timePerQuestion,
      categories: exercise.categories.map((c) => ({ id: c.id, name: c.name })),
      items: items.map((i: any) => ({ id: i.id, textContent: i.textContent })),
    });

    return {
      status: 'question_active',
      questionId: this.currentExerciseId,
      timeLimitSeconds: this.timePerQuestion,
    };
  }

  /**
   * Cuenta los estudiantes conectados a una sesión
   * (excluye la consola del profesor).
   */
  getStudentCountForSession(sessionId: number): number {
    return Array.from(this.activePlayers.values()).filter(
      (p) => p.sessionId === sessionId && p.studentId !== 'CONSOLA_PROFESOR',
    ).length;
  }

  /** Cantidad de respuestas recibidas para la pregunta activa. */
  getRespondedCount(): number {
    return this.activeRoundResponses.length;
  }

  /**
   * Registra la respuesta de un estudiante a la pregunta activa.
   *
   * Flujo:
   * 1. Validación (pregunta activa, autenticación, duplicados)
   * 2. Evaluación académica: compara placements contra categorías correctas
   * 3. Mitigación de lag: calcula compensatedLag y decisionTime
   * 4. Almacenamiento en memoria volátil (activeRoundResponses)
   * 5. Persistencia inmediata en BD (latency_logs)
   *
   * @returns Resultado individual de la clasificación
   */
  async registerPlayerResponse(
    socketId: string,
    placements: Record<number, number>,
    clientTimestamp: number,
    protocol: 'WS' | 'HTTP' = 'WS',
  ) {
    if (!this.isQuestionActive) {
      return { status: 'rejected', reason: 'No active exercise round' };
    }

    const player = this.activePlayers.get(socketId);
    if (!player || player.sessionId !== this.currentSessionId) {
      return { status: 'rejected', reason: 'Authentication mismatch' };
    }

    if (player.studentId === 'CONSOLA_PROFESOR') {
      return { status: 'rejected', reason: 'Professor cannot submit' };
    }

    const hasResponded = this.activeRoundResponses.some(
      (r) => r.playerId === player.studentId,
    );
    if (hasResponded) {
      return { status: 'rejected', reason: 'Player has already submitted' };
    }

    // === 1. CAPTURA DEL TIEMPO EN EL SERVIDOR ===
    const arrivalTimestamp = Date.now();

    if (!this.studentSessionStartTimes.has(player.studentId)) {
      this.studentSessionStartTimes.set(player.studentId, clientTimestamp);
    }

    // === 2. EVALUACIÓN ACADÉMICA ===
    const items: any[] = this.currentExercise?.items || [];
    const categories: any[] = this.currentExercise?.categories || [];
    const categoryMap = new Map<number, string>();
    for (const c of categories) categoryMap.set(c.id, c.name);

    let correctCount = 0;
    const itemResults: {
      itemId: number;
      textContent: string;
      correctCategoryId: number;
      correctCategoryName: string;
      placedCategoryId: number | null;
      placedCategoryName: string | null;
      isCorrect: boolean;
    }[] = [];
    for (const item of items) {
      const placedCategoryId = placements[item.id] ?? null;
      const isItemCorrect = placedCategoryId === item.correctCategoryId;
      if (isItemCorrect) correctCount++;
      const placedCategoryName = placedCategoryId
        ? (categoryMap.get(placedCategoryId) ?? null)
        : null;
      itemResults.push({
        itemId: item.id,
        textContent: item.textContent,
        correctCategoryId: item.correctCategoryId,
        correctCategoryName: categoryMap.get(item.correctCategoryId) ?? '',
        placedCategoryId,
        placedCategoryName,
        isCorrect: isItemCorrect,
      });
    }
    const selectedAlternative = JSON.stringify({ protocol, placements });
    const totalItems = items.length || 1;
    const isCorrect = correctCount === totalItems;
    const score = Math.floor((correctCount / totalItems) * 1000);

    // === 3. APLICACIÓN DEL ALGORITMO (MITIGACIÓN DE LAG) ===
    const clientTimestampStr = clientTimestamp.toString();
    const arrivalTimestampStr = arrivalTimestamp.toString();
    const compensatedLag = arrivalTimestamp - clientTimestamp;

    // Buscamos el inicio exacto desde la tabla puente sessionQuestion
    const sessionQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: this.currentSessionId },
        exercise: { id: this.currentExerciseId! },
      },
    });
    const exerciseStartedTime = sessionQuestion?.startedAt
      ? new Date(sessionQuestion.startedAt).getTime()
      : Date.now();

    const decisionTimeSec = Math.max(
      (clientTimestamp - exerciseStartedTime) / 1000,
      0,
    );

    // === 4. RESPALDO EN MEMORIA VOLÁTIL ===
    this.activeRoundResponses.push({
      playerId: player.studentId,
      placements,
      clientTimestamp,
      arrivalTimestamp,
      networkLag: compensatedLag,
      decisionTime: decisionTimeSec,
    });

    // === 5. PRIMERA PERSISTENCIA EN POSTGRESQL (Docker) ===
    try {
      await this.latencyRepository.save({
        sessionId: this.currentSessionId,
        questionId: this.currentExerciseId!,
        playerId: player.studentId,
        selectedAlternative,
        scoreObtained: score,
        isCorrect: isCorrect,
        positionInGame: 0, // Se actualizará al final de la ronda de forma justa
        clientTimestamp: clientTimestampStr,
        arrivalTimestamp: arrivalTimestampStr,
        compensatedLagMs: compensatedLag,
        totalTimeSeconds: parseFloat(decisionTimeSec.toFixed(2)),
      });
    } catch (error) {
      console.error('Error al guardar telemetría en PostgreSQL:', error);
    }

    return {
      status: 'registered',
      result: {
        scoreObtained: score,
        isCorrect,
        totalItems,
        correctCount,
        selectedAlternative,
        itemResults,
      },
    };
  }

  /**
   * Cierra una sesión de juego.
   * Procesa respuestas pendientes si las hay, marca la sesión como inactiva,
   * resetea el estado en memoria y emite eventos de cierre vía WebSocket.
   */
  async closeSession(sessionId: number): Promise<any> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session)
      throw new NotFoundException(`Sesion ID ${sessionId} no encontrada.`);

    if (this.isQuestionActive && this.activeRoundResponses.length > 0) {
      await this.processRoundResults(true);
    }

    session.isActive = false;
    await this.sessionRepository.save(session);

    this.isQuestionActive = false;
    this.currentExerciseId = null;
    this.currentExercise = null;
    this.currentSessionId = null;
    this.activeRoundResponses = [];
    this.studentSessionStartTimes.clear();
    this.isAdvancing = false;

    this.gamificationGateway.emitToSession(sessionId, 'ROUND_CLOSED', {
      status: 'cleared',
      sessionEnded: true,
    });

    this.gamificationGateway.emitToSession(sessionId, 'ROUND_FINAL_SUMMARY', {
      reason: 'Sesion cerrada',
      sessionId,
    });

    return { status: 'session_closed', sessionId };
  }

  /**
   * Procesa los resultados de la ronda/pregunta actual.
   *
   * Algoritmo:
   * 1. Ordena respuestas por clientTimestamp (justicia competitiva)
   * 2. Evalúa cada respuesta contra las categorías correctas
   * 3. Calcula puntaje: (aciertos / totalItems) * 1000
   * 4. Actualiza positionInGame en BD
   * 5. Emite ROUND_SUMMARY a la sala y ROUND_CLOSED a cada estudiante
   *
   * @param skipEmit Si es true, omite el envío de ROUND_CLOSED individual
   * @returns Array con los resultados procesados
   */
  async processRoundResults(skipEmit = false) {
    if (!this.currentSessionId || !this.currentExerciseId) {
      throw new BadRequestException('No active execution state found');
    }

    this.isQuestionActive = false;

    const sessionQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: this.currentSessionId },
        exercise: { id: this.currentExerciseId },
      },
    });

    const exerciseStartedTime = sessionQuestion?.startedAt
      ? new Date(sessionQuestion.startedAt).getTime()
      : Date.now();

    if (sessionQuestion) {
      sessionQuestion.endedAt = new Date();
      await this.sessionQuestionRepository.save(sessionQuestion);
    }

    const exercise = await this.contentService.getExerciseById(
      this.currentExerciseId,
    );
    const items: any[] = (exercise as any).items || [];
    const categories: any[] = (exercise as any).categories || [];
    const categoryMap = new Map<number, string>();
    for (const c of categories) categoryMap.set(c.id, c.name);

    // Ordena respuestas por timestamp del cliente (el que respondió primero, mejor posición)
    const sortedResponses = [...this.activeRoundResponses].sort(
      (a, b) => a.clientTimestamp - b.clientTimestamp,
    );

    const roundSummary = sortedResponses.map((resp, index) => {
      let correctCount = 0;
      const itemResults: {
        itemId: number;
        textContent: string;
        correctCategoryId: number;
        correctCategoryName: string;
        placedCategoryId: number | null;
        placedCategoryName: string | null;
        isCorrect: boolean;
      }[] = [];
      for (const item of items) {
        const placedCategoryId = resp.placements[item.id] ?? null;
        const isItemCorrect = placedCategoryId === item.correctCategoryId;
        if (isItemCorrect) correctCount++;
        const placedCategoryName = placedCategoryId
          ? (categoryMap.get(placedCategoryId) ?? null)
          : null;
        itemResults.push({
          itemId: item.id,
          textContent: item.textContent,
          correctCategoryId: item.correctCategoryId,
          correctCategoryName: categoryMap.get(item.correctCategoryId) ?? '',
          placedCategoryId,
          placedCategoryName,
          isCorrect: isItemCorrect,
        });
      }
      const selectedAlternative = JSON.stringify(itemResults);
      const totalItems = items.length || 1;
      const score = Math.floor((correctCount / totalItems) * 1000);

      const studentResponseTimeSeconds = Math.max(
        (resp.clientTimestamp - exerciseStartedTime) / 1000,
        0,
      );

      const sessionStart = this.studentSessionStartTimes.get(resp.playerId);
      const totalTimeSeconds = sessionStart
        ? parseFloat(
            Math.max((resp.clientTimestamp - sessionStart) / 1000, 0).toFixed(
              2,
            ),
          )
        : studentResponseTimeSeconds;

      return {
        sessionId: this.currentSessionId!,
        questionId: this.currentExerciseId!,
        playerId: resp.playerId,
        selectedAlternative,
        scoreObtained: score,
        isCorrect: correctCount === totalItems,
        positionInGame: index + 1,
        clientTimestamp: resp.clientTimestamp,
        arrivalTimestamp: resp.arrivalTimestamp,
        responseTimeSeconds: parseFloat(studentResponseTimeSeconds.toFixed(2)),
        totalTimeSeconds,
        itemResults,
      };
    });

    for (const summary of roundSummary) {
      try {
        await this.latencyRepository.update(
          {
            sessionId: summary.sessionId,
            questionId: summary.questionId,
            playerId: summary.playerId,
          },
          {
            positionInGame: summary.positionInGame, // Inyectamos el lugar final calculado
          },
        );
      } catch (err) {
        console.error('Error al actualizar posiciones en la BD:', err);
      }
    }

    const summaryPayload = {
      questionId: this.currentExerciseId,
      results: roundSummary,
    };
    this.gamificationGateway.emitToSession(
      this.currentSessionId,
      'ROUND_SUMMARY',
      summaryPayload,
    );

    if (!skipEmit) {
      for (const [socketId, player] of this.activePlayers.entries()) {
        if (player.sessionId === this.currentSessionId) {
          const playerResult = roundSummary.find(
            (r) => r.playerId === player.studentId,
          );

          this.gamificationGateway.emitToSocket(socketId, 'ROUND_CLOSED', {
            status: 'cleared',
            sessionEnded: false,
            scoreObtained: playerResult ? playerResult.scoreObtained : 0,
            isCorrect: playerResult ? playerResult.isCorrect : false,
            position: playerResult ? playerResult.positionInGame : null,
            itemResults: playerResult ? playerResult.itemResults : [],
          });
        }
      }
    }

    this.activeRoundResponses = [];
    return roundSummary;
  }

  /**
   * Emite el resumen final de ronda a cada estudiante individualmente.
   * Incluye puntaje total, tiempo total, y resultados detallados por pregunta.
   */
  private async emitFinalRoundSummary(reason: string) {
    const sessionId = this.currentSessionId!;
    const logs = await this.latencyRepository.find({
      where: { sessionId },
      order: { questionId: 'ASC' },
    });

    for (const [socketId, player] of this.activePlayers.entries()) {
      if (player.sessionId !== sessionId) continue;
      const studentLogs = logs.filter((l) => l.playerId === player.studentId);
      const totalScore = studentLogs.reduce((s, l) => s + l.scoreObtained, 0);
      const totalTime =
        studentLogs.length > 0
          ? studentLogs[studentLogs.length - 1].totalTimeSeconds
          : 0;

      this.gamificationGateway.emitToSocket(socketId, 'ROUND_FINAL_SUMMARY', {
        reason,
        sessionId,
        playerId: player.studentId,
        totalScore,
        totalTime,
        totalQuestions: studentLogs.length,
        results: studentLogs.map((l) => {
          let itemResults = [];
          try {
            itemResults = JSON.parse(l.selectedAlternative);
          } catch (e) {
            itemResults = [];
          }
          return {
            questionId: l.questionId,
            selectedAlternative: l.selectedAlternative,
            scoreObtained: l.scoreObtained,
            isCorrect: l.isCorrect,
            positionInGame: l.positionInGame,
            compensatedLagMs: l.compensatedLagMs,
            totalTimeSeconds: l.totalTimeSeconds,
            itemResults,
          };
        }),
      });
    }
  }
}
