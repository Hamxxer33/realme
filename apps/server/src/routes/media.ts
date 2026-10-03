import { randomUUID } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { type App, type Ctx, fail, requireMembership, requireUser } from '../context';
import { uuid } from '../validation';

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const CHAT_KEY = /^conversations\/([0-9a-f-]{36})\/[0-9a-f-]{36}$/;
const POST_KEY = /^posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;
const STATUS_KEY = /^status\/([0-9a-f-]{36})\/[A-Za-z0-9_-]{1,64}\/[0-9a-f-]{36}$/;

/**
 * Chat media is encrypted on the phone and scoped to the conversation; only
 * members get download URLs. Post photos are public, like the posts themselves.
 */
export function registerMedia(app: App, ctx: Ctx, status: { canSeeStatusesOf(viewerId: string, authorId: string): Promise<boolean> }) {
  const auth = requireUser(ctx);

  app.post('/media/upload-url', auth, zValidator('json', z.object({
    size: z.number().int().min(1).max(MAX_MEDIA_BYTES),
    conversationId: uuid.optional(),
    // Encrypted status photo: stored under the status's client id so it expires with it.
    statusClientId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  })), async (c) => {
    const me = c.var.user;
    const { size, conversationId, statusClientId } = c.req.valid('json');
    if (conversationId) await requireMembership(ctx, conversationId, me.id);
    const objectKey = conversationId
      ? `conversations/${conversationId}/${randomUUID()}`
      : statusClientId ? `status/${me.id}/${statusClientId}/${randomUUID()}` : `posts/${me.id}/${randomUUID()}`;
    return c.json({ objectKey, url: await ctx.storage.presignUpload(objectKey, size) });
  });

  app.post('/media/download-url', auth, zValidator('json', z.object({ objectKey: z.string().max(200) })), async (c) => {
    const { objectKey } = c.req.valid('json');
    const chat = CHAT_KEY.exec(objectKey);
    const story = STATUS_KEY.exec(objectKey);
    if (chat) await requireMembership(ctx, chat[1]!, c.var.user.id);
    else if (story) {
      if (!(await status.canSeeStatusesOf(c.var.user.id, story[1]!))) fail(404, 'Not found');
    } else if (!POST_KEY.test(objectKey)) fail(404, 'Not found');
    return c.json({ url: await ctx.storage.presignDownload(objectKey) });
  });
}
