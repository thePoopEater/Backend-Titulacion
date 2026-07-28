import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExerciseEntity } from './exercise.entity';

/** Categoría de clasificación dentro de un ejercicio. */
@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column()
  exerciseId: number;

  @ManyToOne(() => ExerciseEntity, (ex) => ex.categories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exerciseId' })
  exercise: ExerciseEntity;
}
