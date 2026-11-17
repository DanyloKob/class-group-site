import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { formatDateParam, todayInKyiv } from "@/lib/schedule/parity";

export type Viewer = { id: string; isSuperAdmin: boolean } | null;
export type MaterialKindT = "LINK" | "PDF" | "PPTX";
export type ConversionStatusT = "PENDING" | "READY" | "FAILED";
export type TopicListItem = {
  id: string;
  title: string;
  subject: string | null;
  dueDate: string; // YYYY-MM-DD
  isPast: boolean;
  materialCount: number;
  canDelete: boolean;
};
export type MaterialRow = {
  id: string;
  token: string;
  kind: MaterialKindT;
  text: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  conversionStatus: ConversionStatusT | null;
  createdAt: string; // ISO
  authorName: string;
  canDelete: boolean;
};
export type TopicDetail = {
  id: string;
  title: string;
  subject: string | null;
  dueDate: string;
  isPast: boolean;
  canDelete: boolean;
  materials: MaterialRow[];
};
export type MaterialPublic = Omit<MaterialRow, "canDelete"> & { topic: { id: string; title: string } };

const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

export function isValidMaterialToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** 144 bit, 24 chars of base64url. */
export function newMaterialToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Members see «Прізвище Ім'я», guests only «Ім'я П.» (privacy). */
function displayName(author: { firstName: string; lastName: string }, viewer: Viewer): string {
  if (viewer) return `${author.lastName} ${author.firstName}`.trim();
  const initial = author.lastName.trim().charAt(0);
  return initial ? `${author.firstName} ${initial}.` : author.firstName;
}

function isPastDate(dueDate: string): boolean {
  return dueDate < todayInKyiv();
}

function canDeleteTopic(viewer: Viewer, createdById: string, materialAuthorIds: string[]): boolean {
  if (!viewer) return false;
  if (viewer.isSuperAdmin) return true;
  return createdById === viewer.id && materialAuthorIds.every((id) => id === viewer.id);
}

type MaterialDbRow = {
  id: string;
  token: string;
  kind: MaterialKindT;
  text: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  conversionStatus: ConversionStatusT | null;
  createdAt: Date;
  authorId: string;
  author: { firstName: string; lastName: string };
};

function toMaterialRow(m: MaterialDbRow, viewer: Viewer): MaterialRow {
  return {
    id: m.id,
    token: m.token,
    kind: m.kind,
    text: m.text,
    url: m.url,
    fileName: m.fileName,
    fileSize: m.fileSize,
    conversionStatus: m.conversionStatus,
    createdAt: m.createdAt.toISOString(),
    authorName: displayName(m.author, viewer),
    canDelete: !!viewer && (viewer.isSuperAdmin || m.authorId === viewer.id),
  };
}

/** Upcoming topics soonest first, then past ones most recent first. */
export async function getTopicList(viewer: Viewer): Promise<TopicListItem[]> {
  const topics = await prisma.projectTopic.findMany({
    select: {
      id: true,
      title: true,
      subject: true,
      dueDate: true,
      createdAt: true,
      createdById: true,
      materials: { select: { authorId: true } },
    },
  });

  const items = topics.map((t) => {
    const dueDate = formatDateParam(t.dueDate);
    return {
      createdAt: t.createdAt,
      item: {
        id: t.id,
        title: t.title,
        subject: t.subject,
        dueDate,
        isPast: isPastDate(dueDate),
        materialCount: t.materials.length,
        canDelete: canDeleteTopic(
          viewer,
          t.createdById,
          t.materials.map((m) => m.authorId),
        ),
      } satisfies TopicListItem,
    };
  });

  items.sort((a, b) => {
    if (a.item.isPast !== b.item.isPast) return a.item.isPast ? 1 : -1;
    if (a.item.dueDate !== b.item.dueDate) {
      return a.item.isPast
        ? b.item.dueDate.localeCompare(a.item.dueDate)
        : a.item.dueDate.localeCompare(b.item.dueDate);
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return items.map((x) => x.item);
}

export async function getTopicDetail(topicId: string, viewer: Viewer): Promise<TopicDetail | null> {
  const topic = await prisma.projectTopic.findUnique({
    where: { id: topicId },
    include: {
      materials: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!topic) return null;
  const dueDate = formatDateParam(topic.dueDate);
  return {
    id: topic.id,
    title: topic.title,
    subject: topic.subject,
    dueDate,
    isPast: isPastDate(dueDate),
    canDelete: canDeleteTopic(
      viewer,
      topic.createdById,
      topic.materials.map((m) => m.authorId),
    ),
    materials: topic.materials.map((m) => toMaterialRow(m, viewer)),
  };
}

export async function getMaterialByToken(token: string, viewer: Viewer): Promise<MaterialPublic | null> {
  if (!isValidMaterialToken(token)) return null;
  const material = await prisma.projectMaterial.findUnique({
    where: { token },
    include: {
      author: { select: { firstName: true, lastName: true } },
      topic: { select: { id: true, title: true } },
    },
  });
  if (!material) return null;
  const { canDelete: _canDelete, ...row } = toMaterialRow(material, viewer);
  void _canDelete;
  return { ...row, topic: material.topic };
}
