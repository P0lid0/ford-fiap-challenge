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

export async function logAudit(ev: AuditEvent): Promise<void> {
  try {
    await sql`insert into public.audit_log ${sql({
      actor_id: ev.actor_id ?? null,
      action: ev.action,
      entity: ev.entity,
      entity_id: ev.entity_id ?? null,
      // metadata é jsonb; o tipo do driver exige JSONValue, mas o objeto é livre.
      metadata: sql.json((ev.metadata ?? {}) as postgres.JSONValue),
      ip: ev.ip ?? null,
      user_agent: ev.user_agent ?? null,
    })}`;
  } catch (err) {
    // Audit failure não pode quebrar request — só loga.
    console.error('[audit] failed to write event', err);
  }
}
