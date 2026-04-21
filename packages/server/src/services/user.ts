import { prisma } from "../lib/prisma.js";

export async function upsertByPhone(phone: string) {
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
}

export async function upsertByWechat(
  openId: string,
  nickname?: string,
  avatarUrl?: string,
) {
  return prisma.user.upsert({
    where: { wechatOpenId: openId },
    update: {},
    create: {
      wechatOpenId: openId,
      nickname: nickname ?? null,
      avatarUrl: avatarUrl ?? null,
    },
  });
}

export async function findById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw Object.assign(new Error("用户不存在"), { statusCode: 404 });
  }
  return user;
}

export async function updateProfile(
  id: string,
  data: { nickname?: string; avatarUrl?: string },
) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
    },
  });
}
