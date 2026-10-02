import type { FastifyBaseLogger } from 'fastify';
import type postgres from 'postgres';
import { sql } from './db.js';

export type AuditEvent = {
  actor_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  user_agent?: string | null;
};

export async function logAudit(ev: AuditEvent, logger: FastifyBaseLogger): Promise<void> {
  try {
    await sql`
      insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip, user_agent)
      values (
        ${ev.actor_id ?? null},
        ${ev.action},
        ${ev.entity},
        ${ev.entity_id ?? null},
        ${sql.json((ev.metadata ?? {}) as postgres.JSONValue)},
        ${ev.ip ?? null},
        ${ev.user_agent ?? null}
      )
    `;
  } catch (err) {
    // Audit failure não pode quebrar request — só loga.
    logger.error({ err, action: ev.action }, '[audit] failed to write event');
  }
}
