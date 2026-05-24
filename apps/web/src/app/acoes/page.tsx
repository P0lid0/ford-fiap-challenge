'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone, Phone, MessageCircle, Mail, MapPin, Tag, CalendarClock,
  CheckCircle2, XCircle, Clock, AlertCircle, Filter, X, Loader2,
  Users, TrendingUp, Send, ChevronDown,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import {
  Card, PageHeader, KpiCard, EmptyState, LoadingState, Button,
  Modal, ModalBody, ModalFooter, FormSection, Field,
} from '@/components/ui';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';

const TIPO_META: Record<string, { label: string; icon: any; color: string }> = {
  ligacao:             { label: 'Ligação',           icon: Phone,         color: 'text-blue-600 bg-blue-50' },
  whatsapp:            { label: 'WhatsApp',          icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
  email:               { label: 'E-mail',            icon: Mail,          color: 'text-purple-600 bg-purple-50' },
  sms:                 { label: 'SMS',               icon: MessageCircle, color: 'text-cyan-600 bg-cyan-50' },
  visita_presencial:   { label: 'Visita',            icon: MapPin,        color: 'text-amber-600 bg-amber-50' },
  oferta_enviada:      { label: 'Oferta enviada',    icon: Tag,           color: 'text-rose-600 bg-rose-50' },
  agendamento_revisao: { label: 'Agendou revisão',   icon: CalendarClock, color: 'text-emerald-600 bg-emerald-50' },
  outro:               { label: 'Outro',             icon: Megaphone,     color: 'text-gray-600 bg-gray-50' },
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  planejada:         { label: 'Planejada',     color: 'bg-gray-100 text-gray-700',       icon: Clock },
  em_andamento:      { label: 'Em andamento',  color: 'bg-blue-100 text-blue-700',       icon: Loader2 },
  concluida_sucesso: { label: 'Sucesso',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  concluida_recusa:  { label: 'Recusada',      color: 'bg-rose-100 text-rose-700',       icon: XCircle },
  sem_resposta:      { label: 'Sem resposta',  color: 'bg-amber-100 text-amber-700',     icon: AlertCircle },
  cancelada:         { label: 'Cancelada',     color: 'bg-gray-100 text-gray-500',       icon: X },
};

export default function AcoesPage() {
  const [acoes, setAcoes] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ status?: string; tipo?: string; perfil_alvo?: string }>({});
  const [showCampaign, setShowCampaign] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, k] = await Promise.all([api.listAcoes({ ...filters, limit: 100 }), api.acoesKpis()]);
      setAcoes(a.results);
      setKpis(k);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          eyebrow={<><Megaphone className="w-3 h-3" /> Retenção ativa</>}
          title="Ações & Campanhas"
          description="Toques de retenção — ligações, ofertas, lembretes — individuais ou em lote por perfil."
          action={
            <Button onClick={() => setShowCampaign(true)} icon={Send} size="lg" uppercase>
              Nova campanha
            </Button>
          }
        />

        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard icon={Megaphone} label="Total de ações" value={kpis.total} />
            <KpiCard accent="emerald" icon={CheckCircle2} label="Taxa de conclusão"
              value={`${Math.round(kpis.taxa_conclusao * 100)}%`} />
            <KpiCard accent="emerald" icon={TrendingUp} label="Taxa de sucesso"
              value={`${Math.round(kpis.taxa_sucesso * 100)}%`} />
            <KpiCard icon={Clock} label="Lead time médio"
              value={kpis.lead_time_horas_medio != null ? `${kpis.lead_time_horas_medio}h` : '—'} />
          </div>
        )}

        <Card compact className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            <FilterSelect label="Status" value={filters.status}
              options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
              onChange={v => setFilters({ ...filters, status: v })} />
            <FilterSelect label="Tipo" value={filters.tipo}
              options={Object.entries(TIPO_META).map(([v, m]) => ({ value: v, label: m.label }))}
              onChange={v => setFilters({ ...filters, tipo: v })} />
            <FilterSelect label="Perfil alvo" value={filters.perfil_alvo}
              options={[
                { value: 'fiel', label: 'Fiel' }, { value: 'esquecido', label: 'Esquecido' },
                { value: 'economico', label: 'Econômico' }, { value: 'abandono', label: 'Abandono' },
              ]} onChange={v => setFilters({ ...filters, perfil_alvo: v })} />
            {(filters.status || filters.tipo || filters.perfil_alvo) && (
              <button onClick={() => setFilters({})} className="text-xs text-ford-blue hover:underline">Limpar</button>
            )}
          </div>
        </Card>

        {loading ? (
          <LoadingState text="Carregando ações…" />
        ) : acoes.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nenhuma ação ainda"
            description="Comece registrando ações na ficha de cada cliente, ou dispare uma campanha por perfil."
            action={
              <Button onClick={() => setShowCampaign(true)} icon={Send} size="sm">
                Disparar campanha
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {acoes.map(a => <AcaoCard key={a.id} acao={a} onChange={load} />)}
          </div>
        )}
      </div>

      {showCampaign && (
        <CampaignModal
          onClose={() => setShowCampaign(false)}
          onDone={() => { setShowCampaign(false); load(); }}
        />
      )}
    </Shell>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}
      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
      <option value="">{label}: todos</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function AcaoCard({ acao, onChange }: { acao: any; onChange: () => void }) {
  const tipo = TIPO_META[acao.tipo] ?? TIPO_META.outro;
  const status = STATUS_META[acao.status] ?? STATUS_META.planejada;
  const { confirm, dialog } = useConfirm();
  const [updating, setUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  async function updateStatus(newStatus: string) {
    if (newStatus === acao.status) { setShowStatusMenu(false); return; }
    // Pede confirmação para mudanças "fortes":
    //  - cancelada / concluida_recusa: ações que admitem que algo deu errado
    //  - voltar de uma conclusão pra um status anterior
    const destructive = newStatus === 'cancelada' || newStatus === 'concluida_recusa';
    const stepBack = (acao.status === 'concluida_sucesso' || acao.status === 'concluida_recusa')
      && newStatus !== acao.status;
    if (destructive || stepBack) {
      const ok = await confirm({
        title: `Mudar status para "${STATUS_META[newStatus]?.label ?? newStatus}"?`,
        message: (
          <>
            Status atual: <b>{status.label}</b>. Essa mudança vai ficar registrada no
            histórico e afeta as métricas em <code>/acoes</code> e <code>/carteira</code>.
          </>
        ),
        confirmLabel: 'Sim, mudar',
        cancelLabel: 'Cancelar',
        variant: destructive ? 'danger' : 'warning',
      });
      if (!ok) { setShowStatusMenu(false); return; }
    }
    setUpdating(true);
    try {
      await api.updateAcao(acao.id, { status: newStatus });
      onChange();
    } finally { setUpdating(false); setShowStatusMenu(false); }
  }

  const TipoIcon = tipo.icon;
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-soft hover:shadow-card transition">
      {dialog}
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tipo.color} flex-shrink-0`}>
          <TipoIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
            <div>
              <h3 className="font-bold text-charcoal">{acao.titulo}</h3>
              <Link href={`/clientes/${acao.client_id}`}
                className="text-xs text-slate hover:text-ford-blue inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {acao.clients?.nome_cliente ?? `Cliente ${acao.client_id?.slice(0, 8)}`}
                {' · '}{acao.clients?.modelo_comprado} {acao.clients?.versao_comprada}
              </Link>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {acao.perfil_alvo && <PerfilBadge perfil={acao.perfil_alvo} />}
              <div className="relative">
                <button onClick={() => setShowStatusMenu(!showStatusMenu)} disabled={updating}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${status.color} hover:opacity-80`}>
                  <StatusIcon className={`w-3 h-3 ${updating ? 'animate-spin' : ''}`} />
                  {status.label}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-elevated z-10 min-w-[180px] py-1">
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <button key={k} onClick={() => updateStatus(k)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${k === acao.status ? 'font-bold text-ford-blue' : 'text-slate'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {acao.descricao && <p className="text-sm text-slate mt-1 leading-relaxed">{acao.descricao}</p>}
          {acao.desfecho && (
            <div className="mt-3 bg-gray-50 border-l-2 border-emerald-400 px-3 py-2 rounded-r-lg">
              <div className="label">Desfecho</div>
              <div className="text-sm text-charcoal">{acao.desfecho}</div>
            </div>
          )}
          <div className="text-[10px] text-gray-400 mt-3 flex items-center gap-3 flex-wrap">
            <span>Criada {new Date(acao.created_at).toLocaleString('pt-BR')}</span>
            {acao.completed_at && <span>· Concluída {new Date(acao.completed_at).toLocaleString('pt-BR')}</span>}
            {acao.campaign_id && (
              <span className="inline-flex items-center gap-1 bg-ford-blue-soft text-ford-blue px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                <Megaphone className="w-2.5 h-2.5" /> Campanha
              </span>
            )}
            {typeof acao.risco_no_disparo === 'number' && (
              <span>Risco no disparo: {Math.round(acao.risco_no_disparo * 100)}%</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [perfil, setPerfil] = useState<'fiel' | 'esquecido' | 'economico' | 'abandono'>('esquecido');
  const [tipo, setTipo] = useState('whatsapp');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [riscoMin, setRiscoMin] = useState<number | ''>(0.4);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; campaign_id: string | null; message?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setErr('Título é obrigatório'); return; }
    setLoading(true); setErr(null);
    try {
      const r = await api.campanha({
        perfil, tipo, titulo, descricao: descricao || undefined,
        risco_min: typeof riscoMin === 'number' ? riscoMin : undefined,
        limit,
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal
      title="Nova campanha de retenção"
      description="Cria 1 ação planejada para cada cliente do perfil escolhido."
      icon={Send}
      onClose={onClose}
      size="lg"
    >
      {result ? (
        <ModalBody>
          {result.created > 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-5 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-1">Campanha criada!</h3>
              <p className="text-sm">{result.created} ação(ões) planejada(s).</p>
              {result.campaign_id && (
                <p className="text-[10px] font-mono text-emerald-700 mt-2">ID: {result.campaign_id.slice(0, 8)}</p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-5 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Nenhum cliente match</h3>
              <p className="text-sm">{result.message ?? 'Sem clientes desse perfil/risco na carteira.'}</p>
            </div>
          )}
          <div className="mt-5">
            <Button onClick={onDone} block size="lg" uppercase>Fechar</Button>
          </div>
        </ModalBody>
      ) : (
        <form onSubmit={submit}>
          <ModalBody className="space-y-4">
            <Field label="Perfil alvo" required>
              <select value={perfil} onChange={e => setPerfil(e.target.value as any)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm">
                <option value="abandono">Abandono — alto risco de evasão</option>
                <option value="esquecido">Esquecido — perdeu timing de revisão</option>
                <option value="economico">Econômico — sensível a preço</option>
                <option value="fiel">Fiel — programa de fidelidade</option>
              </select>
            </Field>

            <Field label="Tipo de ação" required>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm">
                {Object.entries(TIPO_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </Field>

            <Field label="Título" required>
              <input type="text" required value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder='Ex: "Lembrete revisão 15.000 km - oferta de busca"'
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
            </Field>

            <Field label="Mensagem / detalhes">
              <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)}
                placeholder="Script da abordagem, oferta específica, etc."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Risco mínimo">
                <input type="number" step={0.05} min={0} max={1} value={riscoMin}
                  onChange={e => setRiscoMin(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
              </Field>
              <Field label="Limite de clientes">
                <input type="number" min={1} max={500} value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
              </Field>
            </div>

            {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

            <p className="text-[10px] text-gray-500 text-center">
              ⚠ Disponível apenas para roles <b>gestor</b> e <b>admin</b>.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
            <Button type="submit" loading={loading} icon={Send} uppercase disabled={!titulo.trim()}>
              {loading ? 'Disparando…' : 'Disparar campanha'}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
