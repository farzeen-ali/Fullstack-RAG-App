import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const MAX_QUESTION_LENGTH = 1000;

export class ChatRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Question must not be empty.' })
  @MaxLength(MAX_QUESTION_LENGTH, {
    message: `Question must be at most ${MAX_QUESTION_LENGTH} characters.`,
  })
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  documentIds?: string[];
}
