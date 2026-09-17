import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SchoolSearchQuery } from './schools.types';

@Controller()
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get(['schools', 'api/v1/schools'])
  async listSchools(@Query() query: SchoolSearchQuery) {
    return this.schoolsService.listSchools(query);
  }

  @Get(['schools/:id', 'api/v1/schools/:id'])
  async getSchool(@Param('id', ParseIntPipe) id: number, @Query('locale') locale?: string) {
    const school = await this.schoolsService.getSchoolDetail(id, locale);
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }
}
