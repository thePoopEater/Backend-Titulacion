import { Module, forwardRef } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationGateway } from './gamification.gateway';
import { ContentModule } from '../content/content.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSessionEntity } from './entities/game-session.entity';
import { SessionQuestionEntity } from './entities/session-question.entity';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSessionEntity, SessionQuestionEntity]),
    ContentModule,
    forwardRef(() => StatisticsModule),
  ],
  providers: [GamificationService, GamificationGateway],
  exports: [GamificationService],
  controllers: [GamificationController],
})
export class GamificationModule {}
