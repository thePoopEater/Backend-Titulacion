import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { GameSessionEntity } from './game-session.entity';
import { ExerciseEntity } from '../../content/entities/exercise.entity';

@Entity('session_questions')
export class SessionQuestionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  isCurrent: boolean;

  @Column({ type: 'int', default: 30 })
  timeLimitSeconds: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @ManyToOne(() => GameSessionEntity, (session) => session.sessionQuestions, {
    onDelete: 'CASCADE',
  })
  session: GameSessionEntity;

  @ManyToOne(() => ExerciseEntity, { onDelete: 'CASCADE' })
  exercise: ExerciseEntity;
}
