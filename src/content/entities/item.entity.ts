import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Ítem que los estudiantes deben clasificar dentro de una categoría. */
@Entity('items')
export class ItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  textContent: string;

  @Column()
  exerciseId: number;

  @Column()
  correctCategoryId: number;
}
