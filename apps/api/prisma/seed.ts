import "dotenv/config";
import { PrismaClient, PublishStatus, Role, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randomStrongPassword(length = 20): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@flyhigh.tv").trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || randomStrongPassword();
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      displayName: "Flyhigh Admin",
      role: Role.ADMIN,
      passwordHash
    }
  });

  const monthlyPlan = await prisma.plan.upsert({
    where: { code: "monthly" },
    update: {},
    create: {
      code: "monthly",
      name: "Monthly",
      interval: "month",
      priceCents: 1299
    }
  });

  await prisma.plan.upsert({
    where: { code: "yearly" },
    update: {},
    create: {
      code: "yearly",
      name: "Yearly",
      interval: "year",
      priceCents: 11999
    }
  });

  await prisma.subscription.upsert({
    where: { id: "seed_admin_subscription" },
    update: {},
    create: {
      id: "seed_admin_subscription",
      userId: admin.id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.ACTIVE,
      provider: "stripe"
    }
  });

  const film1 = await prisma.contentItem.upsert({
    where: { slug: "double-up-sessions" },
    update: {},
    create: {
      slug: "double-up-sessions",
      title: "Double-Up Sessions",
      author: "Flyhigh Originals",
      synopsis: "A high-energy wakeboard film shot across cable parks and boat sets.",
      type: "FILM",
      posterUrl: "https://images.example.com/posters/double-up.jpg",
      playbackUrl: "https://stream.example.com/hls/double-up-sessions.m3u8",
      durationSeconds: 5120,
      releaseYear: 2025,
      tags: ["wakeboard", "film", "featured"],
      isPremium: true,
      publishStatus: PublishStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });

  const film2 = await prisma.contentItem.upsert({
    where: { slug: "park-lines" },
    update: {},
    create: {
      slug: "park-lines",
      title: "Park Lines",
      author: "Pro Team Collective",
      synopsis: "Progressive park riding sessions with behind-the-scenes rider stories.",
      type: "FILM",
      posterUrl: "https://images.example.com/posters/park-lines.jpg",
      playbackUrl: "https://stream.example.com/hls/park-lines.m3u8",
      durationSeconds: 4680,
      releaseYear: 2024,
      tags: ["wakeboard", "park"],
      isPremium: true,
      publishStatus: PublishStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });

  const trailer = await prisma.contentItem.upsert({
    where: { slug: "season-trailer-reel" },
    update: {},
    create: {
      slug: "season-trailer-reel",
      title: "Season Trailer Reel",
      author: "Flyhigh Studio",
      synopsis: "Short trailer reel featuring the latest drops on Flyhigh.tv.",
      type: "TRAILER",
      posterUrl: "https://images.example.com/posters/trailer-reel.jpg",
      playbackUrl: "https://stream.example.com/hls/season-trailer-reel.m3u8",
      durationSeconds: 140,
      releaseYear: 2025,
      tags: ["trailer"],
      isPremium: false,
      publishStatus: PublishStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });

  const newReleases = await prisma.collection.upsert({
    where: { key: "new-releases" },
    update: {},
    create: {
      key: "new-releases",
      title: "New Releases",
      sortOrder: 1
    }
  });

  const freeToWatch = await prisma.collection.upsert({
    where: { key: "free-to-watch" },
    update: {},
    create: {
      key: "free-to-watch",
      title: "Free to Watch",
      sortOrder: 2
    }
  });

  const hero = await prisma.collection.upsert({
    where: { key: "hero" },
    update: {},
    create: {
      key: "hero",
      title: "Hero Banner",
      sortOrder: 0
    }
  });

  await prisma.collectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: hero.id,
        contentId: film1.id
      }
    },
    update: { sortOrder: 1 },
    create: {
      collectionId: hero.id,
      contentId: film1.id,
      sortOrder: 1
    }
  });

  await prisma.collectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: hero.id,
        contentId: film2.id
      }
    },
    update: { sortOrder: 2 },
    create: {
      collectionId: hero.id,
      contentId: film2.id,
      sortOrder: 2
    }
  });

  await prisma.collectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: hero.id,
        contentId: trailer.id
      }
    },
    update: { sortOrder: 3 },
    create: {
      collectionId: hero.id,
      contentId: trailer.id,
      sortOrder: 3
    }
  });

  await prisma.collectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: newReleases.id,
        contentId: film1.id
      }
    },
    update: { sortOrder: 1 },
    create: {
      collectionId: newReleases.id,
      contentId: film1.id,
      sortOrder: 1
    }
  });

  await prisma.collectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: newReleases.id,
        contentId: film2.id
      }
    },
    update: { sortOrder: 2 },
    create: {
      collectionId: newReleases.id,
      contentId: film2.id,
      sortOrder: 2
    }
  });

  await prisma.collectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: freeToWatch.id,
        contentId: trailer.id
      }
    },
    update: { sortOrder: 1 },
    create: {
      collectionId: freeToWatch.id,
      contentId: trailer.id,
      sortOrder: 1
    }
  });

  console.log("Seeded Flyhigh API data");
  console.log("Admin login:", adminEmail, "/ password:", adminPassword);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log("Set SEED_ADMIN_PASSWORD to control this value on future seed runs.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
