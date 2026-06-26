import { PrismaClient, UserRole, Tier, ComplianceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PHOCUS demo data...');

  // School
  const school = await prisma.school.upsert({
    where: { id: 'school-miami-demo' },
    update: {},
    create: {
      id: 'school-miami-demo',
      name: 'Miami Central High School',
      address: '1450 NE 2nd Ave, Miami, FL 33132',
      lat: 25.7959,
      lng: -80.1940,
      geofenceRadius: 300,
      timezone: 'America/New_York',
    },
  });

  // Admin user
  const adminHash = await bcrypt.hash('password', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@phocus.school' },
    update: {},
    create: {
      email: 'admin@phocus.school',
      name: 'Principal Rivera',
      role: UserRole.ADMIN,
      schoolId: school.id,
    },
  });
  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id },
  });

  // Teachers
  const teachers = await Promise.all([
    { name: 'Ms. Carter', email: 'carter@phocus.school' },
    { name: 'Mr. Thompson', email: 'thompson@phocus.school' },
    { name: 'Ms. Williams', email: 'williams@phocus.school' },
    { name: 'Mr. Davis', email: 'davis@phocus.school' },
  ].map(async (t) => {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { email: t.email, name: t.name, role: UserRole.TEACHER, schoolId: school.id },
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    return { user, teacher };
  }));

  // Classes
  const classData = [
    { name: 'AP Math', room: '101', grade: '11', teacherIdx: 0 },
    { name: 'English Lit', room: '203', grade: '10', teacherIdx: 1 },
    { name: 'Biology', room: '305', grade: '11', teacherIdx: 2 },
    { name: 'US History', room: '102', grade: '12', teacherIdx: 3 },
    { name: 'Chemistry', room: '204', grade: '12', teacherIdx: 2 },
    { name: 'Algebra II', room: '103', grade: '10', teacherIdx: 0 },
  ];

  const classes = await Promise.all(classData.map((c) =>
    prisma.class.create({
      data: {
        name: c.name,
        room: c.room,
        grade: c.grade,
        schoolId: school.id,
        teacherId: teachers[c.teacherIdx].teacher.id,
      },
    })
  ));

  // Students (30 across grades 10–12)
  const studentNames = [
    ['Emma Johnson', '12'], ['Liam Williams', '11'], ['Olivia Brown', '10'],
    ['Noah Jones', '12'], ['Ava Garcia', '11'], ['William Martinez', '10'],
    ['Sophia Anderson', '12'], ['James Taylor', '11'], ['Isabella Thomas', '10'],
    ['Oliver Jackson', '12'], ['Mia White', '11'], ['Benjamin Harris', '10'],
    ['Charlotte Martin', '12'], ['Elijah Thompson', '11'], ['Amelia Moore', '10'],
    ['Lucas Jackson', '12'], ['Harper Lee', '11'], ['Mason Clark', '10'],
    ['Evelyn Lewis', '12'], ['Logan Robinson', '11'], ['Abigail Walker', '10'],
    ['Ethan Hall', '12'], ['Emily Young', '11'], ['Alexander Allen', '10'],
    ['Elizabeth King', '12'], ['Daniel Wright', '11'], ['Sofia Scott', '10'],
    ['Matthew Green', '12'], ['Avery Baker', '11'], ['Aiden Nelson', '10'],
  ];

  const tiers: Tier[] = ['BRONZE', 'SILVER', 'GOLD', 'ELITE'];
  const statuses: ComplianceStatus[] = ['COMPLIANT', 'COMPLIANT', 'COMPLIANT', 'NON_COMPLIANT', 'OFFLINE'];

  const students = await Promise.all(studentNames.map(async ([name, grade], i) => {
    const email = `${name.toLowerCase().replace(' ', '.')}@student.phocus.school`;
    const focusScore = Math.floor(Math.random() * 3500);
    const tier = focusScore >= 3000 ? 'ELITE' : focusScore >= 1500 ? 'GOLD' : focusScore >= 500 ? 'SILVER' : 'BRONZE';
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: UserRole.STUDENT, schoolId: school.id },
    });

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        grade,
        focusScore,
        dailyScore: Math.floor(Math.random() * 120),
        weeklyScore: Math.floor(Math.random() * 600),
        tier: tier as Tier,
        streak: Math.floor(Math.random() * 14),
        totalViolations: Math.floor(Math.random() * 8),
        status: status as ComplianceStatus,
        lastSeen: new Date(Date.now() - Math.random() * 300_000),
      },
    });

    // Enroll in 2 classes
    const classA = classes[i % classes.length];
    const classB = classes[(i + 2) % classes.length];
    await prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId: classA.id, studentId: student.id } },
      update: {},
      create: { classId: classA.id, studentId: student.id },
    }).catch(() => {});
    await prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId: classB.id, studentId: student.id } },
      update: {},
      create: { classId: classB.id, studentId: student.id },
    }).catch(() => {});

    return { user, student };
  }));

  // Active sessions for 3 classes
  await Promise.all(classes.slice(0, 3).map((c) =>
    prisma.session.create({
      data: {
        classId: c.id,
        isLocked: true,
        lockedBy: adminUser.id,
        allowedApps: ['com.google.classroom', 'com.apple.calculator'],
      },
    })
  ));

  // Sample violations
  const violationDescriptions = [
    { desc: 'Attempted to open Instagram', app: 'com.instagram.app', impact: -10 },
    { desc: 'VPN detected', app: null, impact: -25 },
    { desc: 'Attempted to open TikTok', app: 'com.zhiliaoapp.musically', impact: -10 },
    { desc: 'App uninstall attempt detected', app: null, impact: -25 },
    { desc: 'Attempted to open Snapchat', app: 'com.snapchat.android', impact: -10 },
  ];

  await Promise.all(students.slice(0, 8).map(async ({ student }, i) => {
    const v = violationDescriptions[i % violationDescriptions.length];
    await prisma.violation.create({
      data: {
        studentId: student.id,
        level: v.impact === -25 ? 'ESCALATION' as any : 'WARNING' as any,
        description: v.desc,
        appAttempted: v.app,
        scoreImpact: v.impact,
        timestamp: new Date(Date.now() - Math.random() * 3_600_000),
      },
    });
  }));

  // Rewards
  await Promise.all([
    { name: 'Lunch Phone Access', description: 'Phone access during lunch period', requiredTier: 'SILVER' as Tier, requiredScore: 500 },
    { name: 'Early Dismissal', description: '5 minutes early from last class', requiredTier: 'GOLD' as Tier, requiredScore: 1500 },
    { name: 'Raffle Entry', description: 'Monthly prize raffle (sneakers, tickets)', requiredTier: 'BRONZE' as Tier, requiredScore: 100 },
    { name: 'Parking Priority', description: 'Reserved parking spot for a week', requiredTier: 'ELITE' as Tier, requiredScore: 3000 },
    { name: 'Event Fast Pass', description: 'Skip the line at school events', requiredTier: 'GOLD' as Tier, requiredScore: 1500 },
  ].map((r) =>
    prisma.reward.create({ data: { ...r, schoolId: school.id } })
  ));

  console.log('Seed complete.');
  console.log(`  School: ${school.name}`);
  // Demo parents — link to first 3 students
  const parentData = [
    { name: 'Linda Johnson', email: 'parent.johnson@demo.rooz.school', childIndex: 0 },
    { name: 'Robert Chen', email: 'parent.chen@demo.rooz.school', childIndex: 1 },
    { name: 'Maria Garcia', email: 'parent.garcia@demo.rooz.school', childIndex: 2 },
  ];

  await Promise.all(parentData.map(async ({ name, email, childIndex }) => {
    const parentUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: UserRole.PARENT, schoolId: school.id },
    });
    const parent = await prisma.parent.upsert({
      where: { userId: parentUser.id },
      update: {},
      create: { userId: parentUser.id },
    });
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: students[childIndex].student.id } },
      update: {},
      create: { parentId: parent.id, studentId: students[childIndex].student.id },
    });
  }));

  console.log(`  Teachers: ${teachers.length}`);
  console.log(`  Classes: ${classes.length}`);
  console.log(`  Students: ${students.length}`);
  console.log(`  Parents: ${parentData.length}`);
  console.log('\nLogin: admin@phocus.school / password');
  console.log('Parent: parent.johnson@demo.rooz.school / password');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
