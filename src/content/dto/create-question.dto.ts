export class CategoryDto {
  name: string;
  descripcion?: string;
}

export class ItemDto {
  textContent: string;
  correctCategoryIndex: number;
}

export class CreateExerciseDto {
  title: string;
  asignatura?: string;
  descripcion?: string;
  categories: CategoryDto[];
  items: ItemDto[];
}

export class UpdateExerciseDto {
  title?: string;
  asignatura?: string;
  descripcion?: string;
  categories?: CategoryDto[];
  items?: ItemDto[];
}
