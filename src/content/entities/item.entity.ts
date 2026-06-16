import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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
