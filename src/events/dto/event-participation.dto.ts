import { IsBoolean } from 'class-validator';

export class EventParticipationDto {
  @IsBoolean()
  participate: boolean;
}
