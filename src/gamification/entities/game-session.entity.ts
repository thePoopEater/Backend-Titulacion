import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { SessionQuestionEntity } from './session-question.entity';

/** Sesión de juego: contenedor de una partida con sus preguntas y estudiantes. */
@Entity('game_sessions')
export class GameSessionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  questionOrder: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(
    () => SessionQuestionEntity,
    (sessionQuestion) => sessionQuestion.session,
  )
  sessionQuestions: SessionQuestionEntity[];
}
