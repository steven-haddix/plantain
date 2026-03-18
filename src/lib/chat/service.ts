import type { UIMessage } from "ai";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chatMessages, chatThreads, users } from "@/db/schema";

export type ChatThreadKind = "ai_dm" | "team_room";

export type ChatHistoryMessage = UIMessage & {
  createdAt: Date;
  threadId: string;
  content?: unknown[];
  clientMessageId?: string | null;
  author?: {
    id: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
};

export type ChatHistoryResult = {
  messages: ChatHistoryMessage[];
  hasMore: boolean;
};

const mapMessage = (message: {
  id: string;
  threadId: string;
  role: string;
  content: unknown;
  createdAt: Date;
  clientMessageId: string | null;
  authorId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
}): ChatHistoryMessage => ({
  id: message.id,
  role: message.role as ChatHistoryMessage["role"],
  parts: (message.content as ChatHistoryMessage["parts"]) ?? [],
  createdAt: message.createdAt,
  threadId: message.threadId,
  content: message.content as unknown[],
  clientMessageId: message.clientMessageId,
  author:
    message.authorId || message.authorName || message.authorAvatarUrl
      ? {
          id: message.authorId,
          name: message.authorName,
          avatarUrl: message.authorAvatarUrl,
        }
      : null,
});

export async function getOrCreateAiThread(tripId: string, userId: string) {
  const threadKey = `ai:${userId}`;
  let [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.tripId, tripId), eq(chatThreads.key, threadKey)));

  if (!thread) {
    const [createdThread] = await db
      .insert(chatThreads)
      .values({
        id: nanoid(),
        tripId,
        ownerUserId: userId,
        kind: "ai_dm",
        key: threadKey,
        title: "Travel Agent",
      })
      .onConflictDoNothing({
        target: [chatThreads.tripId, chatThreads.key],
      })
      .returning();

    if (createdThread) {
      thread = createdThread;
    } else {
      [thread] = await db
        .select()
        .from(chatThreads)
        .where(
          and(eq(chatThreads.tripId, tripId), eq(chatThreads.key, threadKey)),
        );
    }
  }

  return thread;
}

export async function getOrCreateTeamThread(
  tripId: string,
  creatorUserId?: string,
) {
  let [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.tripId, tripId), eq(chatThreads.key, "team")));

  if (!thread) {
    const [createdThread] = await db
      .insert(chatThreads)
      .values({
        id: nanoid(),
        tripId,
        ownerUserId: creatorUserId,
        kind: "team_room",
        key: "team",
        title: "Team Chat",
      })
      .onConflictDoNothing({
        target: [chatThreads.tripId, chatThreads.key],
      })
      .returning();

    if (createdThread) {
      thread = createdThread;
    } else {
      [thread] = await db
        .select()
        .from(chatThreads)
        .where(
          and(eq(chatThreads.tripId, tripId), eq(chatThreads.key, "team")),
        );
    }
  }

  return thread;
}

export async function listMessages(
  threadId: string,
  limit: number,
  cursor?: string,
): Promise<ChatHistoryResult> {
  const conditions = [eq(chatMessages.threadId, threadId)];

  if (cursor) {
    conditions.push(
      sql`${chatMessages.createdAt} < ${new Date(cursor).toISOString()}`,
    );
  }

  const rows = await db
    .select({
      ...getTableColumns(chatMessages),
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.authorUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const resultMessages = hasMore ? rows.slice(0, limit) : rows;

  return {
    messages: resultMessages.reverse().map(mapMessage),
    hasMore,
  };
}

export async function appendMessagesToThread(
  threadId: string,
  messages: (typeof chatMessages.$inferInsert)[],
) {
  if (messages.length === 0) return;

  const lastCreatedAt = messages[messages.length - 1]?.createdAt ?? new Date();

  await db.insert(chatMessages).values(messages);
  await db
    .update(chatThreads)
    .set({ lastMessageAt: lastCreatedAt })
    .where(eq(chatThreads.id, threadId));
}

export async function clearThreadMessages(threadId: string) {
  await db.delete(chatMessages).where(eq(chatMessages.threadId, threadId));
  await db
    .update(chatThreads)
    .set({ lastMessageAt: sql`${chatThreads.createdAt}` })
    .where(eq(chatThreads.id, threadId));
}

export async function createTeamMessage(input: {
  tripId: string;
  userId: string;
  text: string;
  clientMessageId?: string | null;
}) {
  const thread = await getOrCreateTeamThread(input.tripId, input.userId);
  const trimmed = input.text.trim();

  if (!trimmed) {
    throw new Error("Message text is required.");
  }

  if (input.clientMessageId) {
    const [existingMessage] = await db
      .select({
        ...getTableColumns(chatMessages),
        authorId: users.id,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.authorUserId, users.id))
      .where(
        and(
          eq(chatMessages.threadId, thread.id),
          eq(chatMessages.clientMessageId, input.clientMessageId),
        ),
      );

    if (existingMessage) {
      return mapMessage(existingMessage);
    }
  }

  const createdAt = new Date();
  const [message] = await db
    .insert(chatMessages)
    .values({
      id: nanoid(),
      threadId: thread.id,
      authorUserId: input.userId,
      role: "user",
      content: [{ type: "text", text: trimmed }],
      clientMessageId: input.clientMessageId ?? null,
      createdAt,
    })
    .returning();

  await db
    .update(chatThreads)
    .set({ lastMessageAt: createdAt })
    .where(eq(chatThreads.id, thread.id));

  const [messageWithAuthor] = await db
    .select({
      ...getTableColumns(chatMessages),
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.authorUserId, users.id))
    .where(eq(chatMessages.id, message.id));

  return mapMessage(messageWithAuthor);
}
