import type { OtpChallenge, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const createOtpChallenge = (
  data: Prisma.OtpChallengeCreateInput,
): Promise<OtpChallenge> => prisma.otpChallenge.create({ data });

export const findLatestActiveChallenge = (
  phone: string,
  now: Date,
): Promise<OtpChallenge | null> =>
  prisma.otpChallenge.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });

export const incrementChallengeAttempts = (
  id: string,
): Promise<OtpChallenge> =>
  prisma.otpChallenge.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });

export const consumeChallenge = (id: string): Promise<OtpChallenge> =>
  prisma.otpChallenge.update({
    where: { id },
    data: { consumedAt: new Date() },
  });

export const countRecentChallenges = (
  phone: string,
  since: Date,
): Promise<number> =>
  prisma.otpChallenge.count({ where: { phone, createdAt: { gt: since } } });
