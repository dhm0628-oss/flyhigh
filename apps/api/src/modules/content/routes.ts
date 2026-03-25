import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ContentType, Prisma, PublishStatus, Role } from "@prisma/client";
import type { WatchProgress } from "@prisma/client";
import type { ContentCard, HomeFeedResponse } from "@flyhigh/contracts";
import { sendOpsAlert } from "../../lib/alerts.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../lib/http.js";
import { createMuxAssetClip, createMuxAssetFromUrl, createMuxDirectUpload, getMuxPlaybackUrl, getMuxPosterUrl, isMuxConfigured } from "../../lib/mux.js";
import { prisma } from "../../lib/prisma.js";
import { getAuthContext, hasActiveEntitlement } from "../../lib/viewer.js";
import { ensurePosterUploadsDir, extFromMimeType, getPosterUploadsDir, MAX_POSTER_UPLOAD_BYTES } from "../../lib/uploads.js";

const PREVIEW_PASSTHROUGH_PREFIX = "preview:";
const AUTO_PREVIEW_DURATION_SECONDS = 10;

function mapContentCard(item: {
  id: string;
  slug: string;
  title: string;
  author?: string | null;
  synopsis: string;
  posterUrl: string;
  heroPreviewUrl?: string | null;
  playbackUrl?: string | null;
  muxPlaybackId?: string | null;
  durationSeconds: number;
  releaseYear: number | null;
  tags: string[];
  isPremium: boolean;
  type: ContentType;
}): ContentCard {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    author: item.author ?? undefined,
    synopsis: item.synopsis,
    type: item.type.toLowerCase() as ContentCard["type"],
    posterUrl: resolvePosterUrl(item),
    previewUrl:
      item.heroPreviewUrl?.trim()
        ? item.heroPreviewUrl
        : item.isPremium
          ? undefined
          : item.muxPlaybackId
            ? getMuxPlaybackUrl(item.muxPlaybackId)
            : item.playbackUrl ?? undefined,
    durationSeconds: item.durationSeconds,
    releaseYear: item.releaseYear ?? undefined,
    tags: item.tags,
    isPremium: item.isPremium
  };
}

function parseContentType(value?: string): ContentType | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized in ContentType) {
    return normalized as ContentType;
  }
  return undefined;
}

function parsePublishStatus(value?: string): PublishStatus | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized in PublishStatus) {
    return normalized as PublishStatus;
  }
  return undefined;
}

function resolvePosterUrl(item: { posterUrl: string; muxPlaybackId?: string | null }): string {
  const posterUrl = item.posterUrl?.trim() ?? "";
  const isPlaceholderPoster =
    !posterUrl ||
    posterUrl === "/home/hero-banner.jpg";

  if (!isPlaceholderPoster) {
    return posterUrl;
  }
  if (item.muxPlaybackId) {
    return getMuxPosterUrl(item.muxPlaybackId);
  }
  return "";
}

const contentHasPlaybackWhere: Prisma.ContentItemWhereInput = {
  OR: [
    { muxPlaybackId: { not: null } },
    { playbackUrl: { not: null } }
  ]
};

function normalizeIngestUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must start with http:// or https://");
  }

  if (parsed.hostname.endsWith("dropbox.com")) {
    parsed.searchParams.delete("raw");
    parsed.searchParams.set("dl", "1");
  }

  return parsed.toString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireAdmin(_app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
  const auth = await getAuthContext(request);
  if (!auth) {
    unauthorized(reply);
    return null;
  }
  if (auth.user.role !== Role.ADMIN) {
    forbidden(reply);
    return null;
  }
  return auth;
}

export async function registerContentRoutes(app: FastifyInstance) {
  app.get("/v1/content/home", async () => {
    try {
      const collections = await prisma.collection.findMany({
        where: { isActive: true, isPublic: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          items: {
            orderBy: [{ sortOrder: "asc" }],
            include: { content: true }
          }
        }
      });

      const resolveCollectionItems = async (collection: (typeof collections)[number]) => {
        try {
          const manualItems = collection.items
            .map((item) => item.content)
            .filter((content): content is NonNullable<typeof content> => Boolean(content))
            .filter((content) => content.publishStatus === PublishStatus.PUBLISHED)
            .map(mapContentCard);

          if (collection.sourceTag?.trim()) {
            const taggedItems = await prisma.contentItem.findMany({
              where: {
                publishStatus: PublishStatus.PUBLISHED,
                tags: { has: collection.sourceTag.trim() }
              },
              orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
              take: Math.max(1, Math.min(collection.sourceLimit || 24, 48))
            });
            if (taggedItems.length > 0) {
              return taggedItems.map(mapContentCard);
            }
            return manualItems;
          }

          return manualItems;
        } catch (error) {
          app.log.error(
            {
              err: error,
              collectionId: collection.id,
              collectionKey: collection.key
            },
            "content.home.collection_failed"
          );
          return [];
        }
      };

      const heroCollection = collections.find((collection) => collection.key.toLowerCase() === "hero");
      const featuredItemsFromHero = heroCollection ? await resolveCollectionItems(heroCollection) : [];

      const rowCollections = collections.filter((collection) => collection.id !== heroCollection?.id);
      const rowItems = await Promise.all(
        rowCollections.map(async (collection) => ({
          id: collection.id,
          title: collection.title,
          items: await resolveCollectionItems(collection)
        }))
      );
      const rows = rowItems.filter((row) => row.items.length > 0);

      const fallbackFeaturedItems = rows
        .flatMap((row) => row.items)
        .filter((item) => Array.isArray(item.tags) && item.tags.includes("featured"))
        .slice(0, 6);
      const featuredItems =
        featuredItemsFromHero.length > 0
          ? featuredItemsFromHero.slice(0, 10)
          : fallbackFeaturedItems.length > 0
            ? fallbackFeaturedItems
            : rows.flatMap((row) => row.items).slice(0, 6);

      const featuredSource =
        featuredItems[0] ??
        rows[0]?.items[0] ??
        null;

      const response: HomeFeedResponse = {
        featured: featuredSource,
        featuredItems,
        rows
      };

      return response;
    } catch (error) {
      app.log.error({ err: error }, "content.home.failed");
      const response: HomeFeedResponse = {
        featured: null,
        featuredItems: [],
        rows: []
      };
      return response;
    }
  });

  app.post("/v1/analytics/hero-events", async (request, reply) => {
    const body = (request.body ?? {}) as {
      eventType?: string;
      contentId?: string;
      platform?: string;
      path?: string;
      sessionId?: string;
    };
    const eventTypeRaw = body.eventType?.trim().toUpperCase();
    if (eventTypeRaw !== "IMPRESSION" && eventTypeRaw !== "CLICK") {
      return badRequest(reply, "eventType must be impression or click");
    }

    const contentId = body.contentId?.trim() || null;
    if (contentId) {
      const exists = await prisma.contentItem.findUnique({
        where: { id: contentId },
        select: { id: true }
      });
      if (!exists) {
        return badRequest(reply, "Invalid contentId");
      }
    }

    await prisma.heroEvent.create({
      data: {
        eventType: eventTypeRaw,
        contentId,
        platform: body.platform?.trim() || "web",
        path: body.path?.trim() || null,
        sessionId: body.sessionId?.trim() || null
      }
    });

    return { ok: true };
  });

  app.get("/v1/content/catalog", async (request, reply) => {
    const query = (request.query ?? {}) as {
      q?: string;
      type?: string;
      access?: string;
      tag?: string;
      author?: string;
      sort?: string;
      limit?: string | number;
      offset?: string | number;
    };

    const q = query.q?.trim() ?? "";
    const tag = query.tag?.trim() ?? "";
    const author = query.author?.trim() ?? "";
    const parsedType = parseContentType(query.type);
    if (query.type && !parsedType && query.type !== "all") {
      return badRequest(reply, "Invalid content type filter");
    }

    const access = (query.access ?? "all").toString().trim().toLowerCase();
    if (!["all", "premium", "free"].includes(access)) {
      return badRequest(reply, "Invalid access filter");
    }

    const sort = (query.sort ?? "featured").toString().trim().toLowerCase();
    if (!["featured", "newest", "title", "author"].includes(sort)) {
      return badRequest(reply, "Invalid sort");
    }

    const limitRaw = Number(query.limit ?? 48);
    const offsetRaw = Number(query.offset ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 48;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const where: Prisma.ContentItemWhereInput = {
      publishStatus: PublishStatus.PUBLISHED,
      AND: [contentHasPlaybackWhere]
    };

    if (parsedType) {
      where.type = parsedType;
    }
    if (access === "premium") where.isPremium = true;
    if (access === "free") where.isPremium = false;
    if (tag && tag.toLowerCase() !== "all") {
      where.tags = { has: tag };
    }
    if (author && author.toLowerCase() !== "all") {
      where.author = { equals: author, mode: "insensitive" };
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { synopsis: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
        { author: { contains: q, mode: "insensitive" } }
      ];
    }

    const orderBy =
      sort === "newest"
        ? [{ releaseYear: "desc" as const }, { publishedAt: "desc" as const }, { title: "asc" as const }]
        : sort === "author"
          ? [{ author: "asc" as const }, { title: "asc" as const }]
        : sort === "title"
          ? [{ title: "asc" as const }]
          : [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }];

    const [total, items] = await Promise.all([
      prisma.contentItem.count({ where }),
      prisma.contentItem.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit
      })
    ]);

    return {
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
      items: items.map(mapContentCard)
    };
  });

  app.get("/v1/content/tags", async () => {
    const rows = await prisma.contentItem.findMany({
      where: {
        publishStatus: PublishStatus.PUBLISHED,
        AND: [contentHasPlaybackWhere]
      },
      select: { tags: true }
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) {
        const key = tag.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const tags = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));

    return { tags };
  });

  app.get("/v1/content/authors", async () => {
    const rows = await prisma.contentItem.findMany({
      where: {
        publishStatus: PublishStatus.PUBLISHED,
        author: { not: null },
        AND: [contentHasPlaybackWhere]
      },
      select: { author: true }
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.author?.trim() ?? "";
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const authors = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([authorName, count]) => ({ author: authorName, count }));

    return { authors };
  });

  app.get("/v1/content/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    if (!slug) {
      return badRequest(reply, "Missing slug");
    }

    const auth = await getAuthContext(request);
    const allowUnpublished = auth?.user.role === Role.ADMIN;

    const item = await prisma.contentItem.findUnique({ where: { slug } });
    if (!item || (!allowUnpublished && item.publishStatus !== PublishStatus.PUBLISHED)) {
      return notFound(reply, "Content not found");
    }

    return {
      ...mapContentCard(item),
      playbackAvailable: !!(item.playbackUrl || item.muxPlaybackId),
      publishStatus: item.publishStatus.toLowerCase(),
      publishedAt: item.publishedAt?.toISOString() ?? null,
      videoStatus: item.videoStatus,
      muxAssetId: item.muxAssetId,
      muxPlaybackId: item.muxPlaybackId
    };
  });

  app.post("/v1/content/:id/playback", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.contentItem.findUnique({ where: { id } });

    if (!item || item.publishStatus !== PublishStatus.PUBLISHED) {
      return notFound(reply, "Content not found");
    }

    const resolvedPlaybackUrl = item.muxPlaybackId ? getMuxPlaybackUrl(item.muxPlaybackId) : item.playbackUrl;

    if (!resolvedPlaybackUrl) {
      request.log.warn(
        {
          reqId: request.id,
          contentId: id,
          muxPlaybackId: item.muxPlaybackId,
          hasPlaybackUrl: Boolean(item.playbackUrl)
        },
        "playback.unavailable"
      );
      await sendOpsAlert(
        {
          service: "flyhigh-api",
          level: "warn",
          kind: "playback_failure",
          message: "Playback unavailable for published content",
          reqId: request.id,
          method: request.method,
          url: request.url,
          statusCode: 409,
          metadata: {
            contentId: id,
            muxPlaybackId: item.muxPlaybackId ?? null,
            hasPlaybackUrl: Boolean(item.playbackUrl)
          }
        },
        request.log
      );
      return reply.status(409).send({
        contentId: id,
        allowed: false,
        reason: "unavailable"
      });
    }

    if (item.isPremium) {
      const auth = await getAuthContext(request);
      if (!auth) {
        return reply.status(401).send({
          contentId: id,
          allowed: false,
          reason: "requires_subscription"
        });
      }

      const entitled = hasActiveEntitlement(auth.latestSubscription?.status);
      if (!entitled) {
        return reply.status(403).send({
          contentId: id,
          allowed: false,
          reason: "requires_subscription"
        });
      }
    }

    return {
      contentId: id,
      allowed: true,
      playbackUrl: resolvedPlaybackUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  });

  app.get("/v1/viewer/continue-watching", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const entries = await prisma.watchProgress.findMany({
      where: {
        userId: auth.user.id,
        completed: false,
        positionSeconds: { gt: 0 },
        content: { publishStatus: PublishStatus.PUBLISHED }
      },
      orderBy: [{ lastPlayedAt: "desc" }],
      take: 20,
      include: {
        content: true
      }
    });

    return {
      title: "Continue Watching",
      items: entries.map((entry: WatchProgress & { content: Parameters<typeof mapContentCard>[0] }) => ({
        ...mapContentCard(entry.content),
        progressPercent: Math.max(0, Math.min(100, Math.round(entry.progressPercent))),
        positionSeconds: entry.positionSeconds,
        lastPlayedAt: entry.lastPlayedAt.toISOString()
      }))
    };
  });

  app.get("/v1/viewer/history", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const entries = await prisma.watchProgress.findMany({
      where: {
        userId: auth.user.id,
        positionSeconds: { gt: 0 },
        content: { publishStatus: PublishStatus.PUBLISHED }
      },
      orderBy: [{ lastPlayedAt: "desc" }],
      take: 50,
      include: {
        content: true
      }
    });

    return {
      title: "Watch History",
      items: entries.map((entry: WatchProgress & { content: Parameters<typeof mapContentCard>[0] }) => ({
        ...mapContentCard(entry.content),
        progressPercent: Math.max(0, Math.min(100, Math.round(entry.progressPercent))),
        positionSeconds: entry.positionSeconds,
        completed: entry.completed,
        lastPlayedAt: entry.lastPlayedAt.toISOString()
      }))
    };
  });

  app.get("/v1/viewer/my-list", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const entries = await prisma.myListItem.findMany({
      where: {
        userId: auth.user.id,
        content: { publishStatus: PublishStatus.PUBLISHED }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: { content: true }
    });

    return {
      title: "My List",
      items: entries.map((entry: { content: Parameters<typeof mapContentCard>[0] }) => mapContentCard(entry.content))
    };
  });

  app.get("/v1/viewer/my-list/:contentId", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const { contentId } = request.params as { contentId: string };
    if (!contentId) {
      return badRequest(reply, "contentId is required");
    }

    const found = await prisma.myListItem.findUnique({
      where: {
        userId_contentId: {
          userId: auth.user.id,
          contentId
        }
      }
    });

    return {
      contentId,
      inMyList: Boolean(found)
    };
  });

  app.post("/v1/viewer/my-list", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const body = (request.body ?? {}) as { contentId?: string };
    const contentId = body.contentId?.trim();
    if (!contentId) {
      return badRequest(reply, "contentId is required");
    }

    const content = await prisma.contentItem.findUnique({ where: { id: contentId } });
    if (!content || content.publishStatus !== PublishStatus.PUBLISHED) {
      return notFound(reply, "Content not found");
    }

    await prisma.myListItem.upsert({
      where: {
        userId_contentId: {
          userId: auth.user.id,
          contentId
        }
      },
      update: {},
      create: {
        userId: auth.user.id,
        contentId
      }
    });

    return {
      ok: true,
      contentId,
      inMyList: true
    };
  });

  app.delete("/v1/viewer/my-list/:contentId", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const { contentId } = request.params as { contentId: string };
    if (!contentId) {
      return badRequest(reply, "contentId is required");
    }

    const result = await prisma.myListItem.deleteMany({
      where: {
        userId: auth.user.id,
        contentId
      }
    });

    return {
      ok: true,
      contentId,
      inMyList: false,
      deleted: result.count
    };
  });

  app.delete("/v1/viewer/history", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const result = await prisma.watchProgress.deleteMany({
      where: { userId: auth.user.id }
    });

    return { ok: true, deleted: result.count };
  });

  app.post("/v1/viewer/progress", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const body = (request.body ?? {}) as {
      contentId?: string;
      positionSeconds?: number;
      durationSeconds?: number;
      completed?: boolean;
    };

    if (!body.contentId) {
      return badRequest(reply, "contentId is required");
    }

    const content = await prisma.contentItem.findUnique({ where: { id: body.contentId } });
    if (!content || content.publishStatus !== PublishStatus.PUBLISHED) {
      return notFound(reply, "Content not found");
    }

    const positionSeconds = Math.max(0, Math.round(Number(body.positionSeconds ?? 0)));
    const fallbackDuration = content.durationSeconds > 0 ? content.durationSeconds : 0;
    const durationSeconds = Math.max(0, Math.round(Number(body.durationSeconds ?? fallbackDuration)));
    const computedCompleted =
      body.completed === true ||
      (durationSeconds > 0 && positionSeconds >= Math.max(1, durationSeconds - 15));
    const progressPercent =
      durationSeconds > 0 ? Math.min(100, (positionSeconds / durationSeconds) * 100) : 0;

    const record = await prisma.watchProgress.upsert({
      where: {
        userId_contentId: {
          userId: auth.user.id,
          contentId: body.contentId
        }
      },
      update: {
        positionSeconds,
        durationSeconds,
        progressPercent,
        completed: computedCompleted,
        lastPlayedAt: new Date()
      },
      create: {
        userId: auth.user.id,
        contentId: body.contentId,
        positionSeconds,
        durationSeconds,
        progressPercent,
        completed: computedCompleted,
        lastPlayedAt: new Date()
      }
    });

    return {
      ok: true,
      contentId: record.contentId,
      positionSeconds: record.positionSeconds,
      progressPercent: Math.round(record.progressPercent),
      completed: record.completed
    };
  });

  app.get("/v1/viewer/progress/:contentId", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const { contentId } = request.params as { contentId: string };
    if (!contentId) {
      return badRequest(reply, "contentId is required");
    }

    const record = await prisma.watchProgress.findUnique({
      where: {
        userId_contentId: {
          userId: auth.user.id,
          contentId
        }
      }
    });

    if (!record) {
      return {
        contentId,
        hasProgress: false,
        positionSeconds: 0,
        progressPercent: 0,
        completed: false
      };
    }

    return {
      contentId,
      hasProgress: record.positionSeconds > 0,
      positionSeconds: record.positionSeconds,
      progressPercent: Math.round(record.progressPercent),
      completed: record.completed,
      lastPlayedAt: record.lastPlayedAt.toISOString()
    };
  });

  app.delete("/v1/viewer/progress/:contentId", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }

    const { contentId } = request.params as { contentId: string };
    if (!contentId) {
      return badRequest(reply, "contentId is required");
    }

    const result = await prisma.watchProgress.deleteMany({
      where: {
        userId: auth.user.id,
        contentId
      }
    });

    return { ok: true, deleted: result.count };
  });

  app.get("/v1/admin/content", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const items = await prisma.contentItem.findMany({
      orderBy: [{ createdAt: "desc" }]
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        author: item.author,
        synopsis: item.synopsis,
        type: item.type.toLowerCase(),
        publishStatus: item.publishStatus.toLowerCase(),
        isPremium: item.isPremium,
        posterUrl: item.posterUrl,
        heroPreviewUrl: item.heroPreviewUrl,
        playbackUrl: item.playbackUrl,
        durationSeconds: item.durationSeconds,
        releaseYear: item.releaseYear,
        tags: item.tags,
        videoStatus: item.videoStatus,
        videoProvider: item.videoProvider,
        muxAssetId: item.muxAssetId,
        muxPlaybackId: item.muxPlaybackId,
        updatedAt: item.updatedAt.toISOString()
      }))
    };
  });

  app.post("/v1/admin/content", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const body = (request.body ?? {}) as {
      slug?: string;
      title?: string;
      synopsis?: string;
      author?: string | null;
      type?: string;
      posterUrl?: string;
      heroPreviewUrl?: string | null;
      playbackUrl?: string | null;
      durationSeconds?: number;
      releaseYear?: number | null;
      tags?: string[];
      isPremium?: boolean;
      publishStatus?: string;
    };

    const slug = body.slug?.trim();
    const title = body.title?.trim();
    const synopsis = body.synopsis?.trim() ?? "";
    const type = parseContentType(body.type) ?? ContentType.FILM;
    const publishStatus = parsePublishStatus(body.publishStatus) ?? PublishStatus.DRAFT;

    if (!slug || !title) {
      return badRequest(reply, "slug and title are required");
    }

    const created = await prisma.contentItem.create({
      data: {
        slug,
        title,
        author: body.author?.trim() || null,
        synopsis,
        type,
        posterUrl: body.posterUrl?.trim() ?? "",
        heroPreviewUrl: body.heroPreviewUrl?.trim() || null,
        playbackUrl: body.playbackUrl?.trim() || null,
        videoProvider: body.playbackUrl ? "manual" : null,
        videoStatus: body.playbackUrl ? "ready" : "none",
        durationSeconds: Math.max(0, Number(body.durationSeconds ?? 0)),
        releaseYear: body.releaseYear ?? null,
        tags: Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean) : [],
        isPremium: body.isPremium ?? true,
        publishStatus,
        publishedAt: publishStatus === PublishStatus.PUBLISHED ? new Date() : null
      }
    });

    return reply.status(201).send({
      id: created.id,
      slug: created.slug
    });
  });

  app.patch("/v1/admin/content/:id", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;

    const existing = await prisma.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return notFound(reply, "Content not found");
    }

    const data: Record<string, unknown> = {};

    if (typeof body.slug === "string" && body.slug.trim()) data.slug = body.slug.trim();
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.author === "string") data.author = body.author.trim() || null;
    if (body.author === null) data.author = null;
    if (typeof body.synopsis === "string") data.synopsis = body.synopsis.trim();
    if (typeof body.posterUrl === "string") data.posterUrl = body.posterUrl.trim();
    if (typeof body.heroPreviewUrl === "string") data.heroPreviewUrl = body.heroPreviewUrl.trim() || null;
    if (body.heroPreviewUrl === null) data.heroPreviewUrl = null;
    if (typeof body.playbackUrl === "string") {
      const trimmed = body.playbackUrl.trim();
      data.playbackUrl = trimmed;
      data.videoProvider = trimmed ? "manual" : null;
      data.videoStatus = trimmed ? "ready" : existing.videoStatus;
    }
    if (body.playbackUrl === null) {
      data.playbackUrl = null;
      if (!existing.muxPlaybackId) {
        data.videoProvider = null;
        data.videoStatus = "none";
      }
    }
    if (typeof body.durationSeconds === "number") data.durationSeconds = Math.max(0, body.durationSeconds);
    if (typeof body.releaseYear === "number") data.releaseYear = body.releaseYear;
    if (body.releaseYear === null) data.releaseYear = null;
    if (typeof body.isPremium === "boolean") data.isPremium = body.isPremium;
    if (Array.isArray(body.tags)) {
      data.tags = body.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    if (typeof body.type === "string") {
      const parsedType = parseContentType(body.type);
      if (!parsedType) {
        return badRequest(reply, "Invalid content type");
      }
      data.type = parsedType;
    }
    if (typeof body.publishStatus === "string") {
      const nextStatus = parsePublishStatus(body.publishStatus);
      if (!nextStatus) {
        return badRequest(reply, "Invalid publishStatus");
      }
      data.publishStatus = nextStatus;
      if (nextStatus === PublishStatus.PUBLISHED && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    const updated = await prisma.contentItem.update({
      where: { id },
      data
    });

    return {
      id: updated.id,
      slug: updated.slug,
      updatedAt: updated.updatedAt.toISOString()
    };
  });

  app.delete("/v1/admin/content/:id", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const existing = await prisma.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return notFound(reply, "Content not found");
    }

    await prisma.contentItem.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/v1/admin/content/:id/video-upload", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    if (!isMuxConfigured()) {
      return reply.status(503).send({ error: "Mux is not configured on the server" });
    }

    const { id } = request.params as { id: string };
    const item = await prisma.contentItem.findUnique({ where: { id } });
    if (!item) {
      return notFound(reply, "Content not found");
    }

    const requestOrigin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    let upload;
    try {
      upload = await createMuxDirectUpload({
        contentId: item.id,
        corsOrigin: requestOrigin
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mux upload creation failed";
      request.log.error({ contentId: item.id, muxOrigin: requestOrigin, err }, "mux.direct_upload_create_failed");
      return reply.status(502).send({ error: message });
    }

    await prisma.contentItem.update({
      where: { id: item.id },
      data: {
        videoProvider: "mux",
        videoStatus: "upload_created",
        muxUploadId: upload.id,
        muxAssetId: null,
        muxPlaybackId: null,
        videoError: null
      }
    });

    return {
      provider: "mux",
      contentId: item.id,
      uploadId: upload.id,
      uploadUrl: upload.url,
      status: upload.status
    };
  });

  app.post("/v1/admin/content/:id/video-import-url", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    if (!isMuxConfigured()) {
      return reply.status(503).send({ error: "Mux is not configured on the server" });
    }

    const { id } = request.params as { id: string };
    const item = await prisma.contentItem.findUnique({ where: { id } });
    if (!item) {
      return notFound(reply, "Content not found");
    }

    const body = (request.body ?? {}) as { sourceUrl?: string };
    if (!body.sourceUrl?.trim()) {
      return badRequest(reply, "sourceUrl is required");
    }

    let sourceUrl: string;
    try {
      sourceUrl = normalizeIngestUrl(body.sourceUrl);
    } catch (err) {
      return badRequest(reply, err instanceof Error ? err.message : "Invalid sourceUrl");
    }

    let asset;
    try {
      asset = await createMuxAssetFromUrl({
        contentId: item.id,
        inputUrl: sourceUrl
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mux URL import failed";
      request.log.error({ contentId: item.id, sourceUrl, err }, "mux.url_import_create_failed");
      return reply.status(502).send({ error: message });
    }

    await prisma.contentItem.update({
      where: { id: item.id },
      data: {
        videoProvider: "mux",
        videoStatus: asset.status || "processing",
        muxUploadId: null,
        muxAssetId: asset.id,
        muxPlaybackId: null,
        videoError: null
      }
    });

    return {
      provider: "mux",
      contentId: item.id,
      muxAssetId: asset.id,
      status: asset.status,
      sourceUrl
    };
  });

  app.post("/v1/admin/content/bulk-import-url", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    if (!isMuxConfigured()) {
      return reply.status(503).send({ error: "Mux is not configured on the server" });
    }

    const body = (request.body ?? {}) as {
      rows?: Array<{
        title?: string;
        slug?: string;
        sourceUrl?: string;
        author?: string;
        tags?: string[];
        isPremium?: boolean;
        publishStatus?: string;
        type?: string;
        synopsis?: string;
        releaseYear?: number;
        durationSeconds?: number;
      }>;
    };

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return badRequest(reply, "rows is required");
    }

    const rows = body.rows.slice(0, 250);
    const results: Array<{
      row: number;
      ok: boolean;
      contentId?: string;
      slug?: string;
      muxAssetId?: string;
      status?: string;
      sourceUrl?: string;
      error?: string;
    }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 1;
      try {
        const sourceRaw = row.sourceUrl?.trim() ?? "";
        if (!sourceRaw) {
          throw new Error("sourceUrl is required");
        }
        const sourceUrl = normalizeIngestUrl(sourceRaw);

        const candidateSlug = (row.slug?.trim() || slugify(row.title?.trim() ?? "")).trim();
        if (!candidateSlug) {
          throw new Error("slug or title is required");
        }

        let item = await prisma.contentItem.findUnique({ where: { slug: candidateSlug } });
        if (!item) {
          const title = row.title?.trim() || candidateSlug.replace(/-/g, " ");
          const type = parseContentType(row.type) ?? ContentType.FILM;
          const publishStatus = parsePublishStatus(row.publishStatus) ?? PublishStatus.DRAFT;
          const tags = Array.isArray(row.tags) ? row.tags.map((tag) => tag.trim()).filter(Boolean) : [];
          const created = await prisma.contentItem.create({
            data: {
              slug: candidateSlug,
              title,
              author: row.author?.trim() || null,
              synopsis: row.synopsis?.trim() ?? "",
              type,
              posterUrl: "",
              playbackUrl: null,
              videoProvider: "mux",
              videoStatus: "processing",
              durationSeconds: Math.max(0, Math.round(Number(row.durationSeconds ?? 0))),
              releaseYear: typeof row.releaseYear === "number" ? row.releaseYear : null,
              tags,
              isPremium: row.isPremium ?? true,
              publishStatus,
              publishedAt: publishStatus === PublishStatus.PUBLISHED ? new Date() : null
            }
          });
          item = created;
        }

        const asset = await createMuxAssetFromUrl({
          contentId: item.id,
          inputUrl: sourceUrl
        });

        await prisma.contentItem.update({
          where: { id: item.id },
          data: {
            videoProvider: "mux",
            videoStatus: asset.status || "processing",
            muxUploadId: null,
            muxAssetId: asset.id,
            muxPlaybackId: null,
            videoError: null
          }
        });

        results.push({
          row: rowNumber,
          ok: true,
          contentId: item.id,
          slug: item.slug,
          muxAssetId: asset.id,
          status: asset.status,
          sourceUrl
        });
      } catch (err) {
        results.push({
          row: rowNumber,
          ok: false,
          error: err instanceof Error ? err.message : "Import failed"
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    return {
      total: rows.length,
      successCount,
      failedCount: rows.length - successCount,
      results
    };
  });

  app.post("/v1/admin/content/backfill-premium-previews", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    if (!isMuxConfigured()) {
      return reply.status(503).send({ error: "Mux is not configured on the server" });
    }

    const body = (request.body ?? {}) as { limit?: number };
    const limit =
      typeof body.limit === "number"
        ? Math.max(1, Math.min(200, Math.round(body.limit)))
        : 50;

    const candidates = await prisma.contentItem.findMany({
      where: {
        isPremium: true,
        muxAssetId: { not: null },
        heroPreviewUrl: null,
        videoStatus: "ready"
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        muxAssetId: true,
        durationSeconds: true
      }
    });

    const results: Array<{
      contentId: string;
      slug: string;
      title: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const item of candidates) {
      try {
        if (!item.muxAssetId) {
          throw new Error("Missing muxAssetId");
        }

        const clipEndTime = Math.max(
          1,
          Math.min(
            AUTO_PREVIEW_DURATION_SECONDS,
            item.durationSeconds > 0 ? item.durationSeconds : AUTO_PREVIEW_DURATION_SECONDS
          )
        );

        await createMuxAssetClip({
          sourceAssetId: item.muxAssetId,
          passthrough: `${PREVIEW_PASSTHROUGH_PREFIX}${item.id}`,
          startTime: 0,
          endTime: clipEndTime
        });

        results.push({
          contentId: item.id,
          slug: item.slug,
          title: item.title,
          ok: true
        });
      } catch (err) {
        results.push({
          contentId: item.id,
          slug: item.slug,
          title: item.title,
          ok: false,
          error: err instanceof Error ? err.message : "Preview backfill failed"
        });
      }
    }

    return {
      total: candidates.length,
      queued: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results
    };
  });

  app.post("/v1/admin/content/:id/poster-upload", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const item = await prisma.contentItem.findUnique({ where: { id } });
    if (!item) {
      return notFound(reply, "Content not found");
    }

    const body = (request.body ?? {}) as {
      filename?: string;
      mimeType?: string;
      dataBase64?: string;
    };

    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64.trim() : "";
    if (!mimeType.startsWith("image/") || !dataBase64) {
      return badRequest(reply, "mimeType and dataBase64 image payload are required");
    }

    const ext = extFromMimeType(mimeType);
    if (!ext) {
      return badRequest(reply, "Unsupported image type. Use jpg, png, webp, or gif");
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(dataBase64, "base64");
    } catch {
      return badRequest(reply, "Invalid base64 payload");
    }
    if (!bytes.length) {
      return badRequest(reply, "Empty image payload");
    }
    if (bytes.length > MAX_POSTER_UPLOAD_BYTES) {
      return badRequest(reply, `Poster image too large (max ${Math.floor(MAX_POSTER_UPLOAD_BYTES / (1024 * 1024))}MB)`);
    }

    await ensurePosterUploadsDir();
    const safeStem = `${item.id}-${Date.now()}`;
    const filename = `${safeStem}.${ext}`;
    await writeFile(path.join(getPosterUploadsDir(), filename), bytes);

    const host = typeof request.headers.host === "string" ? request.headers.host : "127.0.0.1:4000";
    const protocol = request.protocol || "http";
    const posterUrl = `${protocol}://${host}/uploads/posters/${filename}`;

    await prisma.contentItem.update({
      where: { id: item.id },
      data: { posterUrl }
    });

    return {
      ok: true,
      contentId: item.id,
      posterUrl
    };
  });

  app.get("/v1/admin/collections", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const collections = await prisma.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }],
          include: { content: true }
        }
      }
    });

    return {
      collections: collections.map((collection) => ({
        id: collection.id,
        key: collection.key,
        title: collection.title,
        description: collection.description,
        sourceTag: collection.sourceTag,
        sourceLimit: collection.sourceLimit,
        isActive: collection.isActive,
        isPublic: collection.isPublic,
        sortOrder: collection.sortOrder,
        items: collection.items
          .filter((item) => item.content)
          .map((item) => ({
            contentId: item.contentId,
            sortOrder: item.sortOrder,
            title: item.content.title,
            slug: item.content.slug
          }))
      }))
    };
  });

  app.post("/v1/admin/collections", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const body = (request.body ?? {}) as {
      key?: string;
      title?: string;
      description?: string;
      sourceTag?: string | null;
      sourceLimit?: number;
      sortOrder?: number;
      isActive?: boolean;
      isPublic?: boolean;
    };

    if (!body.key?.trim() || !body.title?.trim()) {
      return badRequest(reply, "key and title are required");
    }

    let collection;
    try {
      collection = await prisma.collection.create({
        data: {
          key: body.key.trim(),
          title: body.title.trim(),
          description: body.description?.trim(),
          sourceTag: typeof body.sourceTag === "string" ? body.sourceTag.trim() || null : null,
          sourceLimit:
            typeof body.sourceLimit === "number" ? Math.max(1, Math.min(48, Math.round(body.sourceLimit))) : 24,
          sortOrder: Math.max(0, Math.round(body.sortOrder ?? 0)),
          isActive: body.isActive ?? true,
          isPublic: body.isPublic ?? true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return badRequest(reply, "A category with that key already exists");
      }
      throw error;
    }

    return reply.status(201).send({
      id: collection.id,
      key: collection.key
    });
  });

  app.patch("/v1/admin/collections/:id", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      title?: string;
      description?: string | null;
      sourceTag?: string | null;
      sourceLimit?: number;
      sortOrder?: number;
      isActive?: boolean;
      isPublic?: boolean;
      items?: Array<{ contentId: string; sortOrder?: number }>;
    };

    const existing = await prisma.collection.findUnique({ where: { id } });
    if (!existing) {
      return notFound(reply, "Collection not found");
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.collection.update({
          where: { id },
          data: {
            title: typeof body.title === "string" ? body.title.trim() : undefined,
            description:
              body.description === null
                ? null
                : typeof body.description === "string"
                  ? body.description.trim()
                  : undefined,
            sourceTag:
              body.sourceTag === null
                ? null
                : typeof body.sourceTag === "string"
                  ? body.sourceTag.trim() || null
                  : undefined,
            sourceLimit:
              typeof body.sourceLimit === "number"
                ? Math.max(1, Math.min(48, Math.round(body.sourceLimit)))
                : undefined,
            sortOrder:
              typeof body.sortOrder === "number" ? Math.max(0, Math.round(body.sortOrder)) : undefined,
            isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
            isPublic: typeof body.isPublic === "boolean" ? body.isPublic : undefined
          }
        });

        if (Array.isArray(body.items)) {
          await tx.collectionItem.deleteMany({ where: { collectionId: id } });
          if (body.items.length > 0) {
            await tx.collectionItem.createMany({
              data: body.items.map((item, index) => ({
                collectionId: id,
                contentId: item.contentId,
                sortOrder: Math.max(0, Math.round(item.sortOrder ?? index + 1))
              }))
            });
          }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return badRequest(reply, "This category update conflicts with an existing record");
      }
      throw error;
    }

    return { ok: true };
  });

  app.patch("/v1/admin/categories/reorder", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const body = (request.body ?? {}) as { orderedIds?: string[] };
    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      return badRequest(reply, "orderedIds is required");
    }

    const uniqueIds = [...new Set(body.orderedIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
    if (!uniqueIds.length) {
      return badRequest(reply, "orderedIds is required");
    }

    const found = await prisma.collection.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true }
    });
    if (found.length !== uniqueIds.length) {
      return badRequest(reply, "One or more category ids are invalid");
    }

    await prisma.$transaction(
      uniqueIds.map((id, index) =>
        prisma.collection.update({
          where: { id },
          data: { sortOrder: index + 1 }
        })
      )
    );

    return { ok: true };
  });

  app.put("/v1/admin/content/:id/categories", async (request, reply) => {
    const auth = await requireAdmin(app, request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { collectionIds?: string[] };
    if (!Array.isArray(body.collectionIds)) {
      return badRequest(reply, "collectionIds is required");
    }

    const existing = await prisma.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return notFound(reply, "Content not found");
    }

    const collectionIds = [...new Set(body.collectionIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
    if (collectionIds.length > 0) {
      const found = await prisma.collection.findMany({
        where: { id: { in: collectionIds } },
        select: { id: true }
      });
      if (found.length !== collectionIds.length) {
        return badRequest(reply, "One or more collectionIds are invalid");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.collectionItem.deleteMany({ where: { contentId: id } });

      for (const collectionId of collectionIds) {
        const maxSort = await tx.collectionItem.aggregate({
          where: { collectionId },
          _max: { sortOrder: true }
        });
        await tx.collectionItem.create({
          data: {
            collectionId,
            contentId: id,
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1
          }
        });
      }
    });

    return { ok: true, contentId: id, collectionIds };
  });
}
