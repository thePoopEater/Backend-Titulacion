export class CategoryDto {
  name: string;
}

export class ItemDto {
  textContent: string;
  correctCategoryIndex: number;
}

export class CreateExerciseDto {
  title: string;
  categories: CategoryDto[];
  items: ItemDto[];
}

export class UpdateExerciseDto {
  title?: string;
  categories?: CategoryDto[];
  items?: ItemDto[];
}
