import { adminClient } from './supabase.js';

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
    await adminClient().from('audit_log').insert({
      actor_id: ev.actor_id ?? null,
      action: ev.action,
      entity: ev.entity,
      entity_id: ev.entity_id ?? null,
      metadata: ev.metadata ?? {},
      ip: ev.ip ?? null,
      user_agent: ev.user_agent ?? null,
    });
  } catch (err) {
    // Audit failure não pode quebrar request — só loga.
    console.error('[audit] failed to write event', err);
  }
}
