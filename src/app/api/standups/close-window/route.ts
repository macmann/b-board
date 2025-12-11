import { NextResponse } from "next/server";

import prisma from "../../../../lib/db";
import { parseDateOnly, parseTimeOnDate } from "../../../../lib/standupWindow";
import { PROJECT_CONTRIBUTOR_ROLES, type ProjectRole } from "../../../../lib/roles";
import {
  emailStandupSummaryToStakeholders,
  saveProjectStandupSummary,
} from "../../../../lib/standupSummary";

export async function POST() {
  const today = parseDateOnly(new Date());

  if (!today) {
    return NextResponse.json({ message: "Unable to resolve today's date" }, { status: 500 });
  }

  const now = new Date();
  const projects = await prisma.project.findMany({
    include: {
      settings: true,
      members: {
        select: {
          userId: true,
          role: true,
        },
      },
    },
  });

  let updatedAttendances = 0;

  for (const project of projects) {
    const windowStart = project.settings?.standupWindowStart;
    const windowEnd = project.settings?.standupWindowEnd;

    if (!windowStart || !windowEnd) continue;

    const windowEndDate = parseTimeOnDate(today, windowEnd);

    // TODO: align window evaluation with project timezones when available.

    if (!windowEndDate || now <= windowEndDate) continue;

    const eligibleMembers = project.members.filter(({ role }) =>
      PROJECT_CONTRIBUTOR_ROLES.includes(role as ProjectRole)
    );

    if (!eligibleMembers.length) continue;

    const todayEntries = await prisma.dailyStandupEntry.findMany({
      where: { projectId: project.id, date: today },
      select: { userId: true },
    });

    const attendanceRecords = await prisma.standupAttendance.findMany({
      where: { projectId: project.id, date: today },
      select: { userId: true, status: true },
    });

    const usersWithEntries = new Set(todayEntries.map((entry) => entry.userId));
    const attendanceStatus = new Map(attendanceRecords.map((record) => [record.userId, record.status]));

    const upserts = eligibleMembers
      .filter((member) => !usersWithEntries.has(member.userId))
      .filter((member) => attendanceStatus.get(member.userId) !== "PRESENT")
      .map((member) =>
        prisma.standupAttendance.upsert({
          where: {
            projectId_userId_date: {
              projectId: project.id,
              userId: member.userId,
              date: today,
            },
          },
          update: { status: "ABSENT" },
          create: {
            projectId: project.id,
            userId: member.userId,
            date: today,
            status: "ABSENT",
          },
        })
      );

    if (upserts.length) {
      await prisma.$transaction(upserts);
      updatedAttendances += upserts.length;
    }

    try {
      await saveProjectStandupSummary(project.id, today);
      await emailStandupSummaryToStakeholders(project.id, today);
    } catch (error) {
      console.error("Failed to generate or send stand-up summary", error);
    }
  }

  return NextResponse.json({ message: "Stand-up windows processed", updatedAttendances });
}
