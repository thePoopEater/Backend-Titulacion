export class CreateSessionDto {
  name: string;
}

export class SetCurrentQuestionDto {
  sessionId: number;
  questionId: number;
}

export class LoginStudentDto {
  studentId: string;
  sessionId: number;
}

export class ConfigureRoundDto {
  sessionId: number;
  questionIds: number[];
  timePerQuestionSeconds: number;
  totalRoundTimeMinutes: number;
}
