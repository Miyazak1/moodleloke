const assert = require('node:assert/strict');
const { MeService } = require('../dist/backend/src/me/me.service.js');

const goals = [];
const availabilities = [];
let profile = null;
let goalId = 0;
let availabilityId = 0;

function orderedActiveGoal(where) {
  return [...goals]
    .filter((item) => item.userId === where.userId && item.examSystemCode === where.examSystemCode && item.status === where.status)
    .sort((a, b) => b.effectiveAt - a.effectiveAt)[0] ?? null;
}

const prisma = {
  async $executeRaw() { return 1; },
  async $transaction(callback) { return callback(prisma); },
  studentScoreGoal: {
    async findFirst(args) {
      if (args.where.status === 'active') return orderedActiveGoal(args.where);
      return [...goals]
        .filter((item) => item.userId === args.where.userId && item.examSystemCode === args.where.examSystemCode && item.examBatchCode === args.where.examBatchCode)
        .sort((a, b) => b.version - a.version)[0] ?? null;
    },
    async updateMany(args) {
      let count = 0;
      goals.forEach((item) => {
        if (item.userId === args.where.userId && item.examSystemCode === args.where.examSystemCode && item.status === args.where.status) {
          Object.assign(item, args.data);
          count += 1;
        }
      });
      return { count };
    },
    async create(args) {
      const now = new Date(`2026-09-14T00:00:0${goalId}.000Z`);
      const item = {
        id: `goal-${++goalId}`,
        ...args.data,
        status: 'active',
        effectiveAt: now,
        createdAt: now,
        subjects: args.data.subjects.create.map((subject, index) => ({ id: `subject-${goalId}-${index}`, ...subject }))
      };
      goals.push(item);
      return item;
    }
  },
  studyAvailabilityPreference: {
    async findFirst(args) {
      const rows = availabilities.filter((item) => item.userId === args.where.userId && (!args.where.status || item.status === args.where.status));
      return [...rows].sort((a, b) => b.version - a.version)[0] ?? null;
    },
    async updateMany(args) {
      let count = 0;
      availabilities.forEach((item) => {
        if (item.userId === args.where.userId && item.status === args.where.status) {
          Object.assign(item, args.data);
          count += 1;
        }
      });
      return { count };
    },
    async create(args) {
      const now = new Date(`2026-09-14T00:01:0${availabilityId}.000Z`);
      const item = { id: `availability-${++availabilityId}`, ...args.data, status: 'active', effectiveAt: now, createdAt: now };
      availabilities.push(item);
      return item;
    }
  },
  studentProfile: {
    async upsert(args) {
      profile = { ...(profile ?? {}), ...args.create, ...args.update };
      return profile;
    }
  }
};

const service = new MeService(prisma, {});

async function main() {
  const empty = await service.getAgentLearningSettings(7);
  assert.equal(empty.scoreGoal.status, 'unset');
  assert.equal(empty.currentScoringPolicyVersion, 'csca-score-unverified-v1');
  assert.equal(empty.studyAvailability.availabilityVersion, 'unset');
  assert.equal(empty.studyAvailability.timezone, 'Asia/Shanghai');

  const firstGoal = await service.updateAgentScoreGoal(7, {
    schemaVersion: '1', examSystemCode: 'csca', examBatchCode: 'csca-2027-03', examDate: '2027-03-15',
    subjectGoals: [{ subject: 'math', targetScore: 85, priority: 1 }, { subject: 'physics', targetScore: 80, priority: 2 }],
    expectedGoalVersion: 'unset',
    expectedScoringPolicyVersion: 'csca-score-unverified-v1'
  });
  assert.equal(firstGoal.status, 'configured');
  assert.equal(firstGoal.goal.goalVersion, 'goal:goal-1:v1');
  assert.deepEqual(profile.targetSubjectCodes, ['math', 'physics']);
  assert.equal(profile.targetExamDate.toISOString().slice(0, 10), '2027-03-15');

  const secondGoal = await service.updateAgentScoreGoal(7, {
    schemaVersion: '1', examSystemCode: 'csca', examBatchCode: 'csca-2027-03', examDate: '2027-03-15',
    subjectGoals: [{ subject: 'chemistry', targetScore: 90, priority: 1 }],
    expectedGoalVersion: firstGoal.goal.goalVersion,
    expectedScoringPolicyVersion: 'csca-score-unverified-v1'
  });
  assert.equal(secondGoal.goal.goalVersion, 'goal:goal-2:v2');
  assert.equal(goals.filter((item) => item.status === 'active').length, 1);
  assert.equal(goals[0].status, 'superseded');

  await assert.rejects(() => service.updateAgentScoreGoal(7, {
    schemaVersion: '1', examSystemCode: 'csca', examBatchCode: 'csca-2027-03', examDate: '2027-03-15',
    subjectGoals: [{ subject: 'math', targetScore: 70, priority: 1 }],
    expectedGoalVersion: firstGoal.goal.goalVersion,
    expectedScoringPolicyVersion: 'csca-score-unverified-v1'
  }), (error) => error.getStatus() === 409 && error.getResponse().code === 'VERSION_CONFLICT');

  await assert.rejects(() => service.updateAgentScoreGoal(7, {
    schemaVersion: '1', examSystemCode: 'csca', examBatchCode: 'csca-2027-03', examDate: '2027-03-15',
    subjectGoals: [{ subject: 'math', targetScore: 80.5, priority: 1 }],
    expectedGoalVersion: secondGoal.goal.goalVersion,
    expectedScoringPolicyVersion: 'csca-score-unverified-v1'
  }), (error) => error.getStatus() === 400 && error.getResponse().code === 'TARGET_SCORE_OUT_OF_RANGE');

  const firstAvailability = await service.updateAgentStudyAvailability(7, {
    schemaVersion: '1', timezone: 'Asia/Shanghai', weeklyMinutesGoal: 300,
    preferredStudyDays: [1, 3, 5], defaultSessionMinutes: 25, expectedAvailabilityVersion: 'unset'
  });
  assert.equal(firstAvailability.availabilityVersion, '1');
  assert.deepEqual(firstAvailability.preferredStudyDays, [1, 3, 5]);

  const secondAvailability = await service.updateAgentStudyAvailability(7, {
    schemaVersion: '1', timezone: 'Asia/Shanghai', weeklyMinutesGoal: 420,
    preferredStudyDays: [2, 4, 6], defaultSessionMinutes: 30,
    expectedAvailabilityVersion: '1'
  });
  assert.equal(secondAvailability.availabilityVersion, '2');
  assert.equal(availabilities.filter((item) => item.status === 'active').length, 1);

  await assert.rejects(() => service.updateAgentStudyAvailability(7, {
    schemaVersion: '1', timezone: 'Not/A-Timezone', weeklyMinutesGoal: 300,
    preferredStudyDays: [1], defaultSessionMinutes: 20,
    expectedAvailabilityVersion: '2'
  }), (error) => error.getStatus() === 400 && error.getResponse().code === 'INVALID_TIMEZONE');

  const current = await service.getAgentLearningSettings(7);
  assert.equal(current.scoreGoal.goal.goalId, 'goal-2');
  assert.equal(current.studyAvailability.weeklyMinutesGoal, 420);
  console.log('AGENT_LEARNING_SETTINGS_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
