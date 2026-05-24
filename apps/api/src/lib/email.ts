/**
 * Envio de e-mail real para ações de retenção (Desafio 2).
 *
 * Provider primário: Resend (https://resend.com). Free tier 100 e-mails/dia,
 * 1 API key, sem servidor SMTP próprio. Perfeito pro nosso caso de uso.
 *
 * Fallback: provider 'mock' que só registra no log e loga no console — útil
 * pra desenvolvimento quando ninguém configurou chave.
 *
 * Auditoria: cada envio cria 1 linha em public.email_logs com remetente,
 * destinatário, status e ID do provider (rastreabilidade LGPD).
 */
import { adminClient } from './supabase.js';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;     // corpo HTML (pode conter texto puro com \n virando <br>)
  from?: string;    // default: configurado em ai_keys.provider='email_from'
  reply_to?: string;
  client_id: string;
  acao_id?: string;
  sent_by_user_id?: string;
};

export type SendEmailResult = {
  ok: boolean;
  log_id: string;
  provider: 'resend' | 'mock';
  provider_message_id: string | null;
  status: 'sent' | 'failed';
  error?: string;
};

async function getEmailKey(name: 'resend' | 'email_from'): Promise<string | null> {
  // Tabela ai_keys já é usada pra outras chaves — reaproveitamos
  const { data } = await adminClient()
    .from('ai_keys').select('api_key').eq('provider', name).maybeSingle();
  return data?.api_key ?? null;
}

/**
 * Envia e-mail via Resend e registra em email_logs.
 * Se RESEND_API_KEY não estiver configurada, cai pra modo mock (loga + grava status='sent' com provider='mock').
 * Modo mock é útil pra demos sem precisar de chave paga.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const sb = adminClient();
  const resendKey = await getEmailKey('resend');
  const configuredFrom = await getEmailKey('email_from');
  const from = input.from
    ?? configuredFrom
    ?? 'FordIQ <onboarding@resend.dev>';  // sandbox Resend (só funciona pra teste em e-mail verificado)

  // 1. Cria o log em status pending — garante audit trail mesmo se o envio quebrar
  const logPayload = {
    acao_id: input.acao_id ?? null,
    client_id: input.client_id,
    sent_by: input.sent_by_user_id ?? null,
    to_email: input.to,
    from_email: from,
    subject: input.subject,
    body_preview: input.html.replace(/<[^>]+>/g, '').slice(0, 200),
    provider: (resendKey ? 'resend' : 'mock') as 'resend' | 'mock',
    status: 'pending' as const,
  };
  const { data: log, error: logErr } = await sb
    .from('email_logs').insert(logPayload).select().single();
  if (logErr || !log) {
    throw new Error(`Falha ao criar log de email: ${logErr?.message ?? 'unknown'}`);
  }

  // 2. Modo mock — sem chave configurada
  if (!resendKey) {
    console.log(`[email:mock] ${from} → ${input.to} :: ${input.subject}`);
    await sb.from('email_logs').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: 'Modo mock — Resend API key não configurada em /configuracoes',
    }).eq('id', log.id);
    return {
      ok: true,
      log_id: log.id,
      provider: 'mock',
      provider_message_id: null,
      status: 'sent',
    };
  }

  // 3. Envio real via Resend HTTP API
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.reply_to ? { reply_to: input.reply_to } : {}),
      }),
    });
    const body = await r.json() as { id?: string; message?: string; name?: string };
    if (!r.ok) {
      const err = body.message ?? body.name ?? `HTTP ${r.status}`;
      await sb.from('email_logs').update({
        status: 'failed',
        error_message: String(err).slice(0, 500),
      }).eq('id', log.id);
      return {
        ok: false,
        log_id: log.id,
        provider: 'resend',
        provider_message_id: null,
        status: 'failed',
        error: err,
      };
    }

    await sb.from('email_logs').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: body.id ?? null,
    }).eq('id', log.id);

    return {
      ok: true,
      log_id: log.id,
      provider: 'resend',
      provider_message_id: body.id ?? null,
      status: 'sent',
    };
  } catch (e: any) {
    await sb.from('email_logs').update({
      status: 'failed',
      error_message: String(e.message ?? e).slice(0, 500),
    }).eq('id', log.id);
    return {
      ok: false,
      log_id: log.id,
      provider: 'resend',
      provider_message_id: null,
      status: 'failed',
      error: e.message ?? String(e),
    };
  }
}

/**
 * Templates prontos por perfil — usado quando a ação não tem corpo customizado.
 * O vendedor pode customizar antes de enviar pelo modal.
 */
export const EMAIL_TEMPLATES = {
  esquecido: {
    subject: (modelo: string) => `${modelo}: sua revisão está atrasada — vamos cuidar dele?`,
    html: (nome: string, modelo: string, dealer: string) => `
      <p>Olá ${nome},</p>
      <p>Notamos que seu <strong>${modelo}</strong> ainda não passou pela revisão recomendada.
      Para manter a garantia e a segurança em dia, agende sua revisão na rede oficial Ford.</p>
      <p>${dealer ? `Sua concessionária: <strong>Dealer ${dealer}</strong>` : ''}</p>
      <p>Para agendar, basta responder este e-mail ou ligar pra concessionária mais próxima.</p>
      <p>Atenciosamente,<br/>Equipe Ford BR</p>
    `,
  },
  abandono: {
    subject: (modelo: string) => `Sentimos sua falta — oferta exclusiva pro seu ${modelo}`,
    html: (nome: string, modelo: string, dealer: string) => `
      <p>Olá ${nome},</p>
      <p>Faz um tempo que seu <strong>${modelo}</strong> não passa pela rede oficial Ford.
      Sabemos que pode haver alternativas, mas a manutenção certificada protege seu investimento
      e a garantia estendida do veículo.</p>
      <p>Como cliente Ford, você tem direito a um <strong>pacote de revisão com 30% de desconto</strong>
      esta semana ${dealer ? `na concessionária Dealer ${dealer}` : ''}.</p>
      <p>Responda este e-mail e nosso consultor entra em contato.</p>
      <p>Atenciosamente,<br/>Equipe Ford BR</p>
    `,
  },
  economico: {
    subject: (modelo: string) => `Pacote de revisão com preço fechado pro seu ${modelo}`,
    html: (nome: string, modelo: string, dealer: string) => `
      <p>Olá ${nome},</p>
      <p>Sabemos que custo importa. Para o seu <strong>${modelo}</strong> temos pacotes de revisão
      com <strong>preço fechado</strong> ${dealer ? `no Dealer ${dealer}` : 'na rede Ford'} —
      assim você sabe exatamente quanto vai pagar antes de levar o carro.</p>
      <p>Inclui peças genuínas Ford e mão de obra especializada.</p>
      <p>Responda para conhecer o pacote do seu modelo.</p>
      <p>Atenciosamente,<br/>Equipe Ford BR</p>
    `,
  },
  fiel: {
    subject: (modelo: string) => `Convite Ford VIP — exclusivo pra clientes do ${modelo}`,
    html: (nome: string, modelo: string, dealer: string) => `
      <p>Olá ${nome},</p>
      <p>Você é um dos nossos clientes mais fiéis da rede Ford com seu <strong>${modelo}</strong>!
      Como reconhecimento, queremos te convidar pro <strong>programa de fidelidade Ford VIP</strong>
      com benefícios exclusivos:</p>
      <ul>
        <li>Test drive prioritário dos lançamentos</li>
        <li>Condição especial pra upgrade do seu modelo atual</li>
        <li>Convite pra eventos exclusivos Ford</li>
      </ul>
      <p>Responda este e-mail para receber os detalhes.</p>
      <p>Atenciosamente,<br/>Equipe Ford BR</p>
    `,
  },
} as const;

export function templateFor(perfil: string | null, modelo: string, nome: string, dealer: string) {
  const key = (perfil && perfil in EMAIL_TEMPLATES) ? perfil as keyof typeof EMAIL_TEMPLATES : 'esquecido';
  const tpl = EMAIL_TEMPLATES[key];
  return {
    subject: tpl.subject(modelo),
    html: tpl.html(nome, modelo, dealer),
  };
}
