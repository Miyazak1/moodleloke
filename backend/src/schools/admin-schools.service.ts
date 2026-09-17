import { Injectable } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import {
  AdminSchoolCreateInput,
  AdminSchoolCscaRuleInput,
  AdminSchoolCscaRuleUpdateInput,
  AdminSchoolImportInput,
  AdminSchoolProgramInput,
  AdminSchoolProgramUpdateInput,
  AdminSchoolScholarshipInput,
  AdminSchoolScholarshipUpdateInput,
  AdminSchoolUpdateInput
} from './schools.types';

@Injectable()
export class AdminSchoolsService {
  constructor(private readonly schoolsService: SchoolsService) {}

  listAdminSchools() {
    return this.schoolsService.listAdminSchools();
  }

  getAdminSchool(id: number) {
    return this.schoolsService.getAdminSchool(id);
  }

  listSchoolChangeLogs(id: number) {
    return this.schoolsService.listSchoolChangeLogs(id);
  }

  createAdminSchool(input: AdminSchoolCreateInput, actorId: number) {
    return this.schoolsService.createAdminSchool(input, actorId);
  }

  updateAdminSchool(id: number, input: AdminSchoolUpdateInput, actorId: number) {
    return this.schoolsService.updateAdminSchool(id, input, actorId);
  }

  archiveAdminSchool(id: number, actorId: number, input: AdminSchoolUpdateInput = {}) {
    return this.schoolsService.archiveAdminSchool(id, actorId, input);
  }

  createAdminSchoolProgram(schoolId: number, input: AdminSchoolProgramInput, actorId: number) {
    return this.schoolsService.createAdminSchoolProgram(schoolId, input, actorId);
  }

  updateAdminSchoolProgram(schoolId: number, programId: number, input: AdminSchoolProgramUpdateInput, actorId: number) {
    return this.schoolsService.updateAdminSchoolProgram(schoolId, programId, input, actorId);
  }

  archiveAdminSchoolProgram(schoolId: number, programId: number, actorId: number, input: AdminSchoolProgramUpdateInput = {}) {
    return this.schoolsService.archiveAdminSchoolProgram(schoolId, programId, actorId, input);
  }

  createAdminSchoolCscaRule(schoolId: number, input: AdminSchoolCscaRuleInput, actorId: number) {
    return this.schoolsService.createAdminSchoolCscaRule(schoolId, input, actorId);
  }

  updateAdminSchoolCscaRule(schoolId: number, ruleId: number, input: AdminSchoolCscaRuleUpdateInput, actorId: number) {
    return this.schoolsService.updateAdminSchoolCscaRule(schoolId, ruleId, input, actorId);
  }

  archiveAdminSchoolCscaRule(schoolId: number, ruleId: number, actorId: number, input: AdminSchoolCscaRuleUpdateInput = {}) {
    return this.schoolsService.archiveAdminSchoolCscaRule(schoolId, ruleId, actorId, input);
  }

  createAdminSchoolScholarship(schoolId: number, input: AdminSchoolScholarshipInput, actorId: number) {
    return this.schoolsService.createAdminSchoolScholarship(schoolId, input, actorId);
  }

  updateAdminSchoolScholarship(schoolId: number, scholarshipId: number, input: AdminSchoolScholarshipUpdateInput, actorId: number) {
    return this.schoolsService.updateAdminSchoolScholarship(schoolId, scholarshipId, input, actorId);
  }

  archiveAdminSchoolScholarship(schoolId: number, scholarshipId: number, actorId: number, input: AdminSchoolScholarshipUpdateInput = {}) {
    return this.schoolsService.archiveAdminSchoolScholarship(schoolId, scholarshipId, actorId, input);
  }

  importAdminSchools(input: AdminSchoolImportInput | AdminSchoolCreateInput[], actorId: number, options: { dryRun?: boolean } = {}) {
    if (options.dryRun) return this.schoolsService.importAdminSchools(input, actorId, { dryRun: true });
    return this.schoolsService.importAdminSchools(input, actorId);
  }
}
