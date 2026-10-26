import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { parseDateParam } from '../common/dates';
import { ManualTargetsDto, OnboardingDto } from './dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  /** Questionnaire: saves answers and the starting weight, computes targets. Re-submitting recalculates. */
  @Put()
  onboard(@CurrentUser() user: AuthUser, @Body() dto: OnboardingDto) {
    return this.profiles.onboard(user.id, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.profiles.get(user.id, parseDateParam(date));
  }

  @Put('targets')
  setTargets(@CurrentUser() user: AuthUser, @Body() dto: ManualTargetsDto) {
    return this.profiles.setManualTargets(user.id, dto);
  }
}
