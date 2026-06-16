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

export interface VRResponse {
  playerId: string;
  placements: Record<number, number>;
  clientTimestamp: number;
  arrivalTimestamp: number;
}

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

  private roundQuestionQueue: number[] = [];
  private roundEndTime: number | null = null;
  private studentSessionStartTimes = new Map<string, number>();
  private isAdvancing = false;

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
  ) {}

  async createSession(dto: CreateSessionDto): Promise<GameSessionEntity> {
    const session = this.sessionRepository.create({ name: dto.name });
    const savedSession = await this.sessionRepository.save(session);
    this.currentSessionId = savedSession.id;
    return savedSession;
  }

  async getActiveSessions(): Promise<GameSessionEntity[]> {
    return await this.sessionRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

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

  removePlayerSocket(socketId: string) {
    this.activePlayers.delete(socketId);
  }

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

    return this.advanceToNextQuestionInQueue();
  }

  async advanceToNextQuestionInQueue() {
    // Process current exercise results before moving on
    if (this.isQuestionActive && this.activeRoundResponses.length > 0) {
      await this.processRoundResults();
    }

    if (this.roundEndTime && Date.now() > this.roundEndTime) {
      this.isQuestionActive = false;
      return { status: 'round_ended', reason: 'Global round time expired' };
    }

    if (this.roundQuestionQueue.length === 0) {
      this.isQuestionActive = false;
      return { status: 'round_completed', reason: 'All exercises processed' };
    }

    const nextExerciseId = this.roundQuestionQueue.shift()!;

    const dto: SetCurrentQuestionDto = {
      sessionId: this.currentSessionId!,
      questionId: nextExerciseId,
    };

    return this.setCurrentQuestionInternal(dto);
  }

  async advanceToQuestionDirect(dto: SetCurrentQuestionDto) {
    this.currentSessionId = dto.sessionId;
    return this.setCurrentQuestionInternal(dto);
  }

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

  getStudentCountForSession(sessionId: number): number {
    return Array.from(this.activePlayers.values()).filter(
      (p) => p.sessionId === sessionId && p.studentId !== 'CONSOLA_PROFESOR',
    ).length;
  }

  getRespondedCount(): number {
    return this.activeRoundResponses.length;
  }

  registerPlayerResponse(
    socketId: string,
    placements: Record<number, number>,
    clientTimestamp: number,
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

    // Track session start time for this student (first response timestamp)
    if (!this.studentSessionStartTimes.has(player.studentId)) {
      this.studentSessionStartTimes.set(player.studentId, clientTimestamp);
    }

    this.activeRoundResponses.push({
      playerId: player.studentId,
      placements,
      clientTimestamp,
      arrivalTimestamp: Date.now(),
    });

    return { status: 'registered' };
  }

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
    this.currentSessionId = null;
    this.activeRoundResponses = [];
    this.studentSessionStartTimes.clear();
    this.isAdvancing = false;

    this.gamificationGateway.server
      .to(`session_${sessionId}`)
      .emit('ROUND_CLOSED', { status: 'cleared', sessionEnded: true });

    return { status: 'session_closed', sessionId };
  }

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

    const sortedResponses = [...this.activeRoundResponses].sort(
      (a, b) => a.clientTimestamp - b.clientTimestamp,
    );

    const roundSummary = sortedResponses.map((resp, index) => {
      let correctCount = 0;
      for (const item of items) {
        const placedCategory = resp.placements[item.id];
        if (placedCategory === item.correctCategoryId) {
          correctCount++;
        }
      }
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
        sessionId: this.currentSessionId,
        questionId: this.currentExerciseId,
        playerId: resp.playerId,
        selectedAlternative: JSON.stringify(resp.placements),
        scoreObtained: score,
        isCorrect: correctCount === totalItems,
        positionInGame: index + 1,
        clientTimestamp: resp.clientTimestamp,
        arrivalTimestamp: resp.arrivalTimestamp,
        responseTimeSeconds: parseFloat(studentResponseTimeSeconds.toFixed(2)),
        totalTimeSeconds,
      };
    });

    await this.statisticsService.saveRoundStats(roundSummary);

    if (!skipEmit) {
      for (const [socketId, player] of this.activePlayers.entries()) {
        if (player.sessionId === this.currentSessionId) {
          const playerResult = roundSummary.find(
            (r) => r.playerId === player.studentId,
          );

          this.gamificationGateway.server.to(socketId).emit('ROUND_CLOSED', {
            status: 'cleared',
            sessionEnded: false,
            scoreObtained: playerResult ? playerResult.scoreObtained : 0,
            isCorrect: playerResult ? playerResult.isCorrect : false,
            position: playerResult ? playerResult.positionInGame : null,
          });
        }
      }
    }

    this.activeRoundResponses = [];
    return roundSummary;
  }
}
