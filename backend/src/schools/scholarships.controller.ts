import { Controller, Get, Param, Query } from '@nestjs/common';
import { ScholarshipsService } from './scholarships.service';

@Controller('api/v1/scholarships')
export class ScholarshipsController {
  constructor(private readonly scholarshipsService: ScholarshipsService) {}

  @Get()
  listScholarships(@Query() query: Record<string, string | undefined>) {
    return this.scholarshipsService.listScholarships(query);
  }

  @Get('types')
  listTypes(@Query('locale') locale?: string) {
    return this.scholarshipsService.listTypes(locale);
  }

  @Get('countries')
  listCountries(@Query('locale') locale?: string) {
    return this.scholarshipsService.listCountries(locale);
  }

  @Get(':slug')
  getScholarship(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.scholarshipsService.getScholarship(slug, locale);
  }
}
