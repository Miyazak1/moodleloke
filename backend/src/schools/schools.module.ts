import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminScholarshipsController } from './admin-scholarships.controller';
import { AdminScholarshipsService } from './admin-scholarships.service';
import { AdminSchoolsController } from './admin-schools.controller';
import { AdminSchoolsService } from './admin-schools.service';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { ScholarshipsController } from './scholarships.controller';
import { ScholarshipsService } from './scholarships.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SchoolsController, AdminSchoolsController, ScholarshipsController, AdminScholarshipsController],
  providers: [SchoolsService, AdminSchoolsService, ScholarshipsService, AdminScholarshipsService],
  exports: [SchoolsService, AdminSchoolsService, ScholarshipsService, AdminScholarshipsService]
})
export class SchoolsModule {}
