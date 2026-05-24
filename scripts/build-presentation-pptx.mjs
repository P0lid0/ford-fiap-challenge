#!/usr/bin/env node
/**
 * Gera Apresentacao_FaroAI.pptx — 14 slides para a Disciplina 3 (Testing/QA).
 *
 * Paleta: Midnight Executive (navy/ice/white) + accent vermelho-ferrari
 * Motif: cards com canto superior-esquerdo arredondado + chip de cor à esquerda
 */
import pptxgen from 'pptxgenjs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'docs', 'deliverables', 'Apresentacao_FaroAI.pptx');
mkdirSync(dirname(OUT), { recursive: true });

// =====================================================================
// PALETA — Midnight Executive customizada
// =====================================================================
const NAVY = '0A1628';        // background dark slides
const NAVY_2 = '152844';      // card bg sobre navy
const ICE = 'CADCFC';         // accent claro
const WHITE = 'FFFFFF';
const FORD_BLUE = '003478';   // tinta Ford pro ícone de parceria
const FERRARI = 'E63946';     // accent vermelho pra destaques

const TEAM = [
  { nome: 'Guilherme', rm: '554962' },
  { nome: 'Pedro',     rm: '555556' },
  { nome: 'Fabrício',  rm: '558216' },
  { nome: 'Vitor',     rm: '554893' },
  { nome: 'Matheus',   rm: '555447' },
];

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';  // 13.333 × 7.5 in (16:9)
pres.title = 'Faro AI — Ford × FIAP Challenge 2026';
pres.author = 'Equipe Faro AI';
pres.company = 'Faro AI';

// Helpers ----------------------------------------------------
function addSlideTitle(slide, opts = {}) {
  const isDark = opts.isDark ?? false;
  slide.background = { color: isDark ? NAVY : WHITE };

  // Header eyebrow + section
  slide.addText(opts.eyebrow ?? '', {
    x: 0.5, y: 0.4, w: 4, h: 0.3,
    fontFace: 'Calibri', fontSize: 10, bold: true,
    color: isDark ? ICE : FORD_BLUE,
    charSpacing: 6,
  });
  slide.addText(opts.title ?? '', {
    x: 0.5, y: 0.75, w: 12, h: 1.0,
    fontFace: 'Calibri', fontSize: 32, bold: true,
    color: isDark ? WHITE : NAVY,
    valign: 'top',
  });

  // Faro AI corner brand (top-right)
  slide.addShape('roundRect', {
    x: 12.2, y: 0.35, w: 0.65, h: 0.45,
    fill: { color: isDark ? FERRARI : FORD_BLUE },
    line: { color: isDark ? FERRARI : FORD_BLUE },
    rectRadius: 0.08,
  });
  slide.addText('FA', {
    x: 12.2, y: 0.35, w: 0.65, h: 0.45,
    fontFace: 'Calibri', fontSize: 14, bold: true,
    color: WHITE, align: 'center', valign: 'middle',
  });

  // Footer
  slide.addText(`Faro AI · ${opts.slideNum ?? ''}`, {
    x: 0.5, y: 7.05, w: 12.3, h: 0.3,
    fontFace: 'Calibri', fontSize: 9,
    color: isDark ? '8A9BAB' : '4A5A6B',
  });
}

function cardBox(slide, { x, y, w, h, color, label, value, sub, isDark = false }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: isDark ? NAVY_2 : 'F4F7FB' },
    line: { color: isDark ? '20354A' : 'E2E8F0', width: 0.5 },
    rectRadius: 0.1,
  });
  // chip de cor à esquerda
  slide.addShape('rect', {
    x, y, w: 0.12, h,
    fill: { color },
    line: { color },
  });
  if (label) {
    slide.addText(label, {
      x: x + 0.25, y: y + 0.15, w: w - 0.35, h: 0.3,
      fontFace: 'Calibri', fontSize: 9, bold: true,
      color: isDark ? ICE : '4A5A6B',
      charSpacing: 4,
    });
  }
  slide.addText(value ?? '', {
    x: x + 0.25, y: y + 0.45, w: w - 0.35, h: h - 0.7,
    fontFace: 'Calibri', fontSize: 11, bold: false,
    color: isDark ? WHITE : NAVY,
    valign: 'top',
  });
  if (sub) {
    slide.addText(sub, {
      x: x + 0.25, y: y + h - 0.4, w: w - 0.35, h: 0.25,
      fontFace: 'Calibri', fontSize: 9, italic: true,
      color: isDark ? '8A9BAB' : '4A5A6B',
    });
  }
}

function bigStat(slide, { x, y, w, value, label, color = FERRARI, isDark = false }) {
  slide.addText(value, {
    x, y, w, h: 1.0,
    fontFace: 'Calibri', fontSize: 56, bold: true,
    color, align: 'left', valign: 'top',
  });
  slide.addText(label, {
    x, y: y + 0.95, w, h: 0.4,
    fontFace: 'Calibri', fontSize: 11, bold: true,
    color: isDark ? ICE : '4A5A6B',
    charSpacing: 4,
  });
}

// =====================================================================
// SLIDE 1 — CAPA (REQUERIDO: nome + RM)
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: NAVY };

  // gradiente radial decorativo simulado com formas
  s.addShape('ellipse', {
    x: -2, y: -2, w: 8, h: 8,
    fill: { color: '152844', transparency: 30 },
    line: { color: '152844' },
  });
  s.addShape('ellipse', {
    x: 9, y: 3, w: 6, h: 6,
    fill: { color: '1A3556', transparency: 50 },
    line: { color: '1A3556' },
  });

  // Logo box + nome empresa
  s.addShape('roundRect', {
    x: 0.7, y: 0.7, w: 1.2, h: 1.2,
    fill: { color: FERRARI }, line: { color: FERRARI },
    rectRadius: 0.15,
  });
  s.addText('FA', {
    x: 0.7, y: 0.7, w: 1.2, h: 1.2,
    fontFace: 'Calibri', fontSize: 38, bold: true,
    color: WHITE, align: 'center', valign: 'middle',
  });

  s.addText('FARO  AI', {
    x: 2.1, y: 0.85, w: 6, h: 0.6,
    fontFace: 'Calibri', fontSize: 28, bold: true,
    color: WHITE, charSpacing: 8,
  });
  s.addText('Inteligência automotiva', {
    x: 2.1, y: 1.4, w: 6, h: 0.4,
    fontFace: 'Calibri', fontSize: 12, italic: true,
    color: ICE,
  });

  // Título central
  s.addText('Inteligência preditiva para retenção VIN Share', {
    x: 0.7, y: 2.7, w: 12, h: 0.9,
    fontFace: 'Calibri', fontSize: 36, bold: true,
    color: WHITE,
  });
  s.addText('Ford × FIAP Challenge 2026 — Sprint Única', {
    x: 0.7, y: 3.65, w: 12, h: 0.4,
    fontFace: 'Calibri', fontSize: 16,
    color: ICE,
  });

  // Equipe — caixa destacada
  s.addShape('roundRect', {
    x: 0.7, y: 4.7, w: 12, h: 1.7,
    fill: { color: NAVY_2 },
    line: { color: '20354A', width: 0.5 },
    rectRadius: 0.1,
  });
  s.addText('EQUIPE — FIAP', {
    x: 0.95, y: 4.85, w: 11.5, h: 0.3,
    fontFace: 'Calibri', fontSize: 9, bold: true,
    color: ICE, charSpacing: 6,
  });
  const cellW = 11.5 / 5;
  TEAM.forEach((m, i) => {
    s.addText(m.nome, {
      x: 0.95 + i * cellW, y: 5.2, w: cellW - 0.2, h: 0.5,
      fontFace: 'Calibri', fontSize: 18, bold: true,
      color: WHITE,
    });
    s.addText(`RM ${m.rm}`, {
      x: 0.95 + i * cellW, y: 5.75, w: cellW - 0.2, h: 0.4,
      fontFace: 'Calibri', fontSize: 11,
      color: ICE,
    });
  });

  // Rodapé
  s.addText('Scrum Master: Prof. Yan Coelho · Entrega: 24/05/2026', {
    x: 0.7, y: 6.7, w: 12, h: 0.3,
    fontFace: 'Calibri', fontSize: 10, italic: true,
    color: '8A9BAB',
  });
  s.addText('Link do vídeo de pitch: [inserir link do Teams]', {
    x: 0.7, y: 7.0, w: 12, h: 0.3,
    fontFace: 'Calibri', fontSize: 9,
    color: FERRARI, bold: true,
  });
}

// =====================================================================
// SLIDE 2 — O PROBLEMA
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'CONTEXTO · DESAFIOS FORD', title: 'O problema que a Ford trouxe', slideNum: '2 / 14' });

  s.addText(
    'A Ford BR vende centenas de milhares de carros por ano — mas apenas uma fração volta à rede oficial pra manutenção. Quanto mais oficinas independentes captam esses clientes, menor o VIN Share da Ford.',
    { x: 0.5, y: 1.85, w: 12.3, h: 1.0, fontFace: 'Calibri', fontSize: 14, color: '2A3A4A', valign: 'top' });

  // 2 cards em duas colunas
  cardBox(s, { x: 0.5, y: 3.0, w: 6.0, h: 3.4, color: FERRARI,
    label: 'DESAFIO 1', value: 'Inteligência Competitiva',
    sub: 'Permitir comparação técnica padronizada entre veículos próprios e concorrentes.' });
  s.addText([
    { text: '• ', options: { bold: true, color: FERRARI } },
    { text: 'Catálogo de fichas técnicas com schema fixo\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '• ', options: { bold: true, color: FERRARI } },
    { text: 'Comparação 2-5 veículos lado a lado\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '• ', options: { bold: true, color: FERRARI } },
    { text: 'Validação: Ford Ranger Raptor (slide oficial)\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '• ', options: { bold: true, color: FERRARI } },
    { text: 'Análise IA com dados de mercado', options: { color: '2A3A4A', fontSize: 12 } },
  ], { x: 0.75, y: 4.1, w: 5.5, h: 2.2, valign: 'top' });

  cardBox(s, { x: 6.8, y: 3.0, w: 6.0, h: 3.4, color: FORD_BLUE,
    label: 'DESAFIO 2', value: 'Retenção VIN Share',
    sub: 'Prever, no ato da compra, quem vai abandonar a rede — e agir antes.' });
  s.addText([
    { text: '• ', options: { bold: true, color: FORD_BLUE } },
    { text: 'Segmentação comportamental (não-supervisionada)\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '• ', options: { bold: true, color: FORD_BLUE } },
    { text: 'Classificação preditiva sem data leakage\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '• ', options: { bold: true, color: FORD_BLUE } },
    { text: 'Leads priorizados + estratégia por perfil\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '• ', options: { bold: true, color: FORD_BLUE } },
    { text: 'Visão 360 + ação operacional', options: { color: '2A3A4A', fontSize: 12 } },
  ], { x: 7.05, y: 4.1, w: 5.5, h: 2.2, valign: 'top' });
}

// =====================================================================
// SLIDE 3 — TAMANHO DO PROBLEMA (Stats)
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'MERCADO · NÚMEROS', title: 'O problema não é só da Ford — é da indústria toda', slideNum: '3 / 14', isDark: true });

  bigStat(s, { x: 0.5, y: 2.0, w: 6, value: 'R$ 80 bi', label: 'PÓS-VENDA AUTOMOTIVO BR/ANO',
    color: FERRARI, isDark: true });
  bigStat(s, { x: 7, y: 2.0, w: 6, value: '< 30%', label: 'FATIA DAS REDES OFICIAIS',
    color: ICE, isDark: true });
  bigStat(s, { x: 0.5, y: 3.9, w: 6, value: '3×', label: 'LTV DO CLIENTE FIEL VS ESPORÁDICO',
    color: ICE, isDark: true });
  bigStat(s, { x: 7, y: 3.9, w: 6, value: '+1 pp', label: 'DE VIN SHARE = DEZENAS DE MILHÕES',
    color: FERRARI, isDark: true });

  s.addShape('roundRect', {
    x: 0.5, y: 5.7, w: 12.3, h: 1.1,
    fill: { color: NAVY_2 }, line: { color: '20354A' },
    rectRadius: 0.1,
  });
  s.addText([
    { text: 'No dataset real Ford BR (175.554 VINs): ', options: { bold: true, color: ICE, fontSize: 13 } },
    { text: '11,3% abandonam após a 1ª revisão · 55,4% perdem o timing da revisão · ',
      options: { color: WHITE, fontSize: 13 } },
    { text: 'só 18,5% são fiéis.', options: { bold: true, color: FERRARI, fontSize: 13 } },
  ], { x: 0.8, y: 5.85, w: 11.7, h: 0.85, valign: 'middle' });
}

// =====================================================================
// SLIDE 4 — A SOLUÇÃO (visão geral)
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'SOLUÇÃO · FARO AI', title: 'Uma plataforma. Dois desafios. Três blocos.', slideNum: '4 / 14' });

  const blocks = [
    { color: FERRARI, num: '01', titulo: 'Catálogo Canônico', desc: '262 atributos × 14 seções no template oficial Ford. Comparação 1:1 com qualquer concorrente.' },
    { color: FORD_BLUE, num: '02', titulo: 'Retenção Preditiva', desc: '175k VINs reais classificados em 4 perfis. 135k leads detectados via risco composto.' },
    { color: '00A896', num: '03', titulo: 'Ação Real', desc: 'E-mail real via Resend com template por perfil. Auditoria LGPD. Loop fechado de retenção.' },
  ];
  blocks.forEach((b, i) => {
    const x = 0.5 + i * 4.3;
    s.addShape('roundRect', {
      x, y: 2.2, w: 4.0, h: 4.4,
      fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' },
      rectRadius: 0.1,
    });
    s.addShape('roundRect', {
      x: x + 0.3, y: 2.5, w: 1.0, h: 1.0,
      fill: { color: b.color }, line: { color: b.color },
      rectRadius: 0.5,
    });
    s.addText(b.num, {
      x: x + 0.3, y: 2.5, w: 1.0, h: 1.0,
      fontFace: 'Calibri', fontSize: 22, bold: true,
      color: WHITE, align: 'center', valign: 'middle',
    });
    s.addText(b.titulo, {
      x: x + 0.3, y: 3.7, w: 3.4, h: 0.5,
      fontFace: 'Calibri', fontSize: 18, bold: true,
      color: NAVY,
    });
    s.addText(b.desc, {
      x: x + 0.3, y: 4.3, w: 3.4, h: 2.0,
      fontFace: 'Calibri', fontSize: 12,
      color: '2A3A4A', valign: 'top',
    });
  });

  s.addText('AI que tem faro pro cliente certo.', {
    x: 0.5, y: 6.7, w: 12.3, h: 0.3,
    fontFace: 'Calibri', fontSize: 12, italic: true, bold: true,
    color: FERRARI, align: 'center',
  });
}

// =====================================================================
// SLIDE 5 — DESAFIO 1: CATÁLOGO CANÔNICO
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'DESAFIO 1 · BLOCO 01', title: 'Schema canônico Ford D1 — 262 atributos', slideNum: '5 / 14' });

  s.addText(
    'A Ford forneceu uma matriz fixa de 262 atributos em 14 seções (Wheels, Connectivity, Ice Line Up, Safety, High tech, 4X4, etc.). Implementamos como schema imutável no banco. Qualquer concorrente cadastrado preenche os mesmos campos — comparação 1:1, sem ambiguidade.',
    { x: 0.5, y: 1.85, w: 12.3, h: 1.0, fontFace: 'Calibri', fontSize: 13, color: '2A3A4A' });

  // 3 stat cards
  bigStat(s, { x: 0.5, y: 3.2, w: 4, value: '262', label: 'ATRIBUTOS CANÔNICOS', color: FERRARI });
  bigStat(s, { x: 4.8, y: 3.2, w: 4, value: '14', label: 'SEÇÕES (Wheels, Safety, 4X4…)', color: FORD_BLUE });
  bigStat(s, { x: 9.1, y: 3.2, w: 4, value: '786', label: 'VALORES POPULADOS NAS 3 RANGER', color: '00A896' });

  // diferenciais como linha de bullets
  s.addShape('roundRect', {
    x: 0.5, y: 4.8, w: 12.3, h: 1.9,
    fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.1,
  });
  s.addText('Por que essa abordagem ganha:', {
    x: 0.75, y: 4.9, w: 12, h: 0.4,
    fontFace: 'Calibri', fontSize: 13, bold: true, color: NAVY,
  });
  s.addText([
    { text: '✓ ', options: { bold: true, color: '00A896' } },
    { text: 'Formato sempre o mesmo, independente do veículo (requisito Ford D1)\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '✓ ', options: { bold: true, color: '00A896' } },
    { text: 'Campos sem valor aparecem como "não disponível" explícito — nada escondido\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '✓ ', options: { bold: true, color: '00A896' } },
    { text: 'IA preenche automaticamente atributos vazios usando metadados do veículo\n', options: { color: '2A3A4A', fontSize: 12 } },
    { text: '✓ ', options: { bold: true, color: '00A896' } },
    { text: 'Comparativo visual com troféu no melhor valor de cada linha', options: { color: '2A3A4A', fontSize: 12 } },
  ], { x: 0.75, y: 5.3, w: 12, h: 1.3, valign: 'top' });
}

// =====================================================================
// SLIDE 6 — DESAFIO 2: RETENÇÃO PREDITIVA
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'DESAFIO 2 · BLOCO 02', title: 'Retenção VIN Share com ML real', slideNum: '6 / 14' });

  s.addText(
    'Ingerimos os 175.554 VINs reais do dataset vin_share_Desafio_02.xlsx. Treinamos XGBoost que classifica cada cliente em 1 de 4 perfis comportamentais — usando APENAS dados disponíveis no momento da compra (zero data leakage).',
    { x: 0.5, y: 1.85, w: 12.3, h: 1.0, fontFace: 'Calibri', fontSize: 13, color: '2A3A4A' });

  // 4 perfis em grid 2x2
  const perfis = [
    { p: 'FIEL', c: '00A896', pct: '18.5%', desc: 'Retorna consistentemente à rede oficial' },
    { p: 'ESQUECIDO', c: 'F4A11A', pct: '55.4%', desc: 'Perde timing — recuperável com lembrete' },
    { p: 'ECONÔMICO', c: '4A90E2', pct: '14.9%', desc: 'Sensível a preço, vínculo frágil' },
    { p: 'ABANDONO', c: 'E63946', pct: '11.3%', desc: 'Migra após 1ª revisão — ação no mesmo dia' },
  ];
  perfis.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 6.2, y = 3.0 + row * 1.7;
    s.addShape('roundRect', {
      x, y, w: 6.0, h: 1.5,
      fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.1,
    });
    s.addShape('rect', { x, y, w: 0.15, h: 1.5, fill: { color: p.c }, line: { color: p.c } });
    s.addText(p.p, {
      x: x + 0.3, y: y + 0.15, w: 3, h: 0.4,
      fontFace: 'Calibri', fontSize: 14, bold: true, color: NAVY, charSpacing: 4,
    });
    s.addText(p.pct, {
      x: x + 3.5, y: y + 0.15, w: 2.4, h: 0.5,
      fontFace: 'Calibri', fontSize: 22, bold: true, color: p.c, align: 'right',
    });
    s.addText(p.desc, {
      x: x + 0.3, y: y + 0.7, w: 5.5, h: 0.7,
      fontFace: 'Calibri', fontSize: 11, color: '2A3A4A',
    });
  });

  s.addText([
    { text: 'Acurácia do XGBoost real: ', options: { color: '4A5A6B', fontSize: 12 } },
    { text: '62,7%', options: { bold: true, color: FERRARI, fontSize: 14 } },
    { text: '   ·   F1-weighted: ', options: { color: '4A5A6B', fontSize: 12 } },
    { text: '0,60', options: { bold: true, color: NAVY, fontSize: 14 } },
    { text: '   ·   Amostras: ', options: { color: '4A5A6B', fontSize: 12 } },
    { text: '140k treino · 35k teste', options: { bold: true, color: NAVY, fontSize: 14 } },
  ], { x: 0.5, y: 6.5, w: 12.3, h: 0.4, align: 'center' });
}

// =====================================================================
// SLIDE 7 — LEADS E AÇÃO REAL
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'BLOCO 03 · AÇÃO REAL', title: 'Do dado à ação — loop fechado', slideNum: '7 / 14' });

  // Big stat à esquerda
  bigStat(s, { x: 0.5, y: 2.0, w: 5.5, value: '135.839', label: 'LEADS DETECTADOS NA BASE',
    color: FERRARI });
  s.addText(
    'Risco composto = perfil_real (XGBoost) + 6 sinais operacionais (revisão atrasada, garantia vencendo, dealer loyalty baixa…). Cada lead exibe POR QUE está no topo — IA explicável.',
    { x: 0.5, y: 3.6, w: 5.5, h: 1.8, fontFace: 'Calibri', fontSize: 12, color: '2A3A4A', valign: 'top' });

  // Pipeline à direita
  s.addShape('roundRect', {
    x: 6.5, y: 2.0, w: 6.3, h: 4.7,
    fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.1,
  });
  s.addText('Pipeline de ação operacional', {
    x: 6.75, y: 2.15, w: 6, h: 0.4,
    fontFace: 'Calibri', fontSize: 13, bold: true, color: NAVY,
  });
  const steps = [
    { n: '1', t: 'Lead aparece no topo', d: 'Filtros: perfil, modelo, dealer, sinal' },
    { n: '2', t: 'Vendedor abre a ficha', d: 'Visão 360: garantia, próxima revisão, histórico' },
    { n: '3', t: 'Dispara e-mail real', d: 'Provider Resend · template por perfil' },
    { n: '4', t: 'Ação fica auditada', d: 'email_logs + acoes_retencao + LGPD' },
  ];
  steps.forEach((st, i) => {
    const y = 2.7 + i * 0.95;
    s.addShape('roundRect', {
      x: 6.75, y, w: 0.6, h: 0.6,
      fill: { color: FORD_BLUE }, line: { color: FORD_BLUE }, rectRadius: 0.3,
    });
    s.addText(st.n, {
      x: 6.75, y, w: 0.6, h: 0.6,
      fontFace: 'Calibri', fontSize: 14, bold: true, color: WHITE,
      align: 'center', valign: 'middle',
    });
    s.addText(st.t, {
      x: 7.5, y, w: 5.2, h: 0.3,
      fontFace: 'Calibri', fontSize: 12, bold: true, color: NAVY,
    });
    s.addText(st.d, {
      x: 7.5, y: y + 0.3, w: 5.2, h: 0.3,
      fontFace: 'Calibri', fontSize: 10, color: '4A5A6B',
    });
  });
}

// =====================================================================
// SLIDE 8 — ARQUITETURA (SOA / Web Services)
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'DISCIPLINA 1 · SOA', title: 'Arquitetura de serviços e Web Services', slideNum: '8 / 14' });

  // 3 colunas — frontend, backend, ml service
  const cols = [
    { titulo: 'Frontend', cor: FERRARI, items: [
      'Next.js 15 + TypeScript (web)',
      'React Native + Expo Router (mobile)',
      'Tailwind + shadcn/ui',
      '11 páginas + 9 telas mobile',
    ]},
    { titulo: 'Backend (Gateway)', cor: FORD_BLUE, items: [
      'Fastify + TypeScript + Zod',
      '30+ rotas REST documentadas',
      'JWT (Supabase) · RBAC 3 roles',
      'Swagger UI em /docs',
    ]},
    { titulo: 'Dados & ML', cor: '00A896', items: [
      'Postgres (Supabase) · 18 migrations',
      'RLS por dealership + role',
      'FastAPI + XGBoost (ML service)',
      'HMAC X-Payload-Signature',
    ]},
  ];
  cols.forEach((c, i) => {
    const x = 0.5 + i * 4.3;
    s.addShape('roundRect', {
      x, y: 2.0, w: 4.0, h: 4.5,
      fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.1,
    });
    s.addShape('rect', { x, y: 2.0, w: 4.0, h: 0.5,
      fill: { color: c.cor }, line: { color: c.cor } });
    s.addText(c.titulo, {
      x: x + 0.25, y: 2.05, w: 3.5, h: 0.4,
      fontFace: 'Calibri', fontSize: 14, bold: true, color: WHITE,
    });
    c.items.forEach((it, j) => {
      s.addText([
        { text: '• ', options: { bold: true, color: c.cor } },
        { text: it, options: { color: '2A3A4A' } },
      ], {
        x: x + 0.25, y: 2.7 + j * 0.7, w: 3.6, h: 0.6,
        fontFace: 'Calibri', fontSize: 11, valign: 'top',
      });
    });
  });

  s.addText('Padrões REST · JSON · OpenAPI 3 · Swagger UI · 100% dos endpoints validados via Zod', {
    x: 0.5, y: 6.7, w: 12.3, h: 0.3,
    fontFace: 'Calibri', fontSize: 10, italic: true,
    color: '4A5A6B', align: 'center',
  });
}

// =====================================================================
// SLIDE 9 — IA & MACHINE LEARNING
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'DISCIPLINA 5 · IA / ML', title: 'Pipeline de Machine Learning', slideNum: '9 / 14' });

  // Pipeline horizontal: Base1 → Cluster → Perfis → Base2 → XGBoost → Predição
  const pipe = [
    { t: 'Base 1', d: 'Histórico completo (pós-compra)', c: FORD_BLUE },
    { t: 'K-Means', d: 'Clustering K=4 validado por elbow + silhouette', c: '00A896' },
    { t: '4 Perfis', d: 'Fiel · Esquecido · Econômico · Abandono', c: 'F4A11A' },
    { t: 'Base 2', d: 'Features pré-compra (sem leakage)', c: FORD_BLUE },
    { t: 'XGBoost', d: 'n_estimators=400 · max_depth=7 · 62,7% acc', c: '00A896' },
    { t: 'Predição', d: 'Perfil + risco_evasão por cliente', c: FERRARI },
  ];
  pipe.forEach((p, i) => {
    const x = 0.5 + i * 2.1;
    s.addShape('roundRect', {
      x, y: 2.0, w: 1.9, h: 1.4,
      fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.1,
    });
    s.addShape('rect', { x, y: 2.0, w: 1.9, h: 0.1, fill: { color: p.c }, line: { color: p.c } });
    s.addText(p.t, {
      x: x + 0.15, y: 2.2, w: 1.6, h: 0.35,
      fontFace: 'Calibri', fontSize: 14, bold: true, color: NAVY,
    });
    s.addText(p.d, {
      x: x + 0.15, y: 2.55, w: 1.6, h: 0.85,
      fontFace: 'Calibri', fontSize: 9, color: '4A5A6B', valign: 'top',
    });
    if (i < pipe.length - 1) {
      s.addText('▶', {
        x: x + 1.85, y: 2.55, w: 0.3, h: 0.4,
        fontFace: 'Calibri', fontSize: 11, color: '4A5A6B',
      });
    }
  });

  // 3 highlights
  cardBox(s, { x: 0.5, y: 3.85, w: 4.0, h: 1.5, color: FERRARI,
    label: 'REGRA DE OURO', value: 'Zero data leakage',
    sub: 'Nenhuma variável pós-compra entra no Base 2' });
  cardBox(s, { x: 4.7, y: 3.85, w: 4.0, h: 1.5, color: FORD_BLUE,
    label: 'MÉTRICAS', value: 'Accuracy · F1 · Matriz confusão',
    sub: 'Reportadas no notebook + relatório PDF' });
  cardBox(s, { x: 8.9, y: 3.85, w: 4.0, h: 1.5, color: '00A896',
    label: 'AÇÕES POR PERFIL', value: '4 templates de retenção',
    sub: 'Codificados em ACOES_POR_PERFIL.json' });

  // Entregáveis
  s.addText('Entregáveis: ', { x: 0.5, y: 5.7, w: 1.5, h: 0.3, fontFace: 'Calibri', fontSize: 11, bold: true, color: NAVY });
  s.addText([
    { text: 'ford_segmentation.ipynb', options: { color: FERRARI, fontFace: 'Consolas', fontSize: 10 } },
    { text: '  ·  Relatorio_Desafio_2_ML.pdf', options: { color: FERRARI, fontFace: 'Consolas', fontSize: 10 } },
    { text: '  ·  classifier_real_v1.joblib', options: { color: FERRARI, fontFace: 'Consolas', fontSize: 10 } },
  ], { x: 2.0, y: 5.7, w: 11, h: 0.3 });
}

// =====================================================================
// SLIDE 10 — CYBERSECURITY
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'DISCIPLINA 4 · CYBERSECURITY', title: '5 eixos de segurança — 100 pts cobertos', slideNum: '10 / 14', isDark: true });

  const eixos = [
    { p: '20', t: 'Validação & Sanitização', d: 'Zod em todas rotas · sem SQL raw · rate-limit 120 req/min · Helmet · multipart 30MB' },
    { p: '20', t: 'Autenticação & RBAC', d: 'JWT Supabase com expiração · 3 papéis (analista/gestor/admin) · RLS Postgres por dealership' },
    { p: '20', t: 'Proteção de APIs', d: 'HTTPS/TLS 1.3 · CORS allowlist · HMAC X-Payload-Signature no ML · throttling' },
    { p: '25', t: 'Dados & Privacidade', d: 'AES-256 at rest · VIN_Hash (pseudonimização) · sem PII em prompts de IA · LGPD-ready' },
    { p: '15', t: 'Monitoramento & Logs', d: 'audit_log estruturado · sem stack trace ao cliente · email_logs LGPD · trilha completa' },
  ];
  eixos.forEach((e, i) => {
    const y = 1.95 + i * 0.95;
    s.addShape('roundRect', {
      x: 0.5, y, w: 12.3, h: 0.8,
      fill: { color: NAVY_2 }, line: { color: '20354A' }, rectRadius: 0.08,
    });
    // Score pill
    s.addShape('roundRect', {
      x: 0.7, y: y + 0.15, w: 1.0, h: 0.5,
      fill: { color: FERRARI }, line: { color: FERRARI }, rectRadius: 0.25,
    });
    s.addText(`${e.p} pts`, {
      x: 0.7, y: y + 0.15, w: 1.0, h: 0.5,
      fontFace: 'Calibri', fontSize: 12, bold: true, color: WHITE,
      align: 'center', valign: 'middle',
    });
    s.addText(e.t, {
      x: 1.9, y: y + 0.1, w: 4.5, h: 0.35,
      fontFace: 'Calibri', fontSize: 13, bold: true, color: WHITE,
    });
    s.addText(e.d, {
      x: 1.9, y: y + 0.42, w: 10.7, h: 0.35,
      fontFace: 'Calibri', fontSize: 10, color: ICE,
    });
  });

  s.addText('Documento completo em docs/SECURITY.md', {
    x: 0.5, y: 6.85, w: 12.3, h: 0.3,
    fontFace: 'Calibri', fontSize: 10, italic: true,
    color: ICE, align: 'center',
  });
}

// =====================================================================
// SLIDE 11 — MOBILE (D2)
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'DISCIPLINA 2 · MOBILE & IoT', title: 'App React Native + Expo Router', slideNum: '11 / 14' });

  // Lado esquerdo: stack
  s.addText('Stack técnica', {
    x: 0.5, y: 1.95, w: 5.5, h: 0.4,
    fontFace: 'Calibri', fontSize: 16, bold: true, color: NAVY,
  });
  const stack = [
    'React Native 0.76 + Expo SDK 52',
    'Expo Router (file-based, deep links)',
    'AsyncStorage + Supabase JS',
    'TypeScript estrito · @ford/ui + @ford/types',
    'iOS + Android (multiplataforma)',
  ];
  stack.forEach((it, j) => {
    s.addText([
      { text: '◆ ', options: { color: FERRARI, bold: true } },
      { text: it, options: { color: '2A3A4A' } },
    ], {
      x: 0.5, y: 2.45 + j * 0.45, w: 5.5, h: 0.4,
      fontFace: 'Calibri', fontSize: 12,
    });
  });

  // Lado direito: telas
  s.addText('9 telas implementadas', {
    x: 6.5, y: 1.95, w: 6.3, h: 0.4,
    fontFace: 'Calibri', fontSize: 16, bold: true, color: NAVY,
  });
  const telas = [
    { t: 'Login', d: 'Auth Supabase + persistent session' },
    { t: 'Carteira (Home)', d: 'KPIs + lista clientes recentes' },
    { t: 'Leads', d: 'Lista priorizada por risco' },
    { t: 'Veículos', d: 'Catálogo + busca + filtros' },
    { t: 'Insights IA', d: 'Briefing executivo da carteira' },
    { t: 'Cliente [id]', d: 'Visão 360 + histórico + ação' },
    { t: 'Novo cliente', d: 'Cadastro com classificação ML' },
    { t: 'Comparar', d: 'Diff de veículos lado-a-lado' },
  ];
  telas.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 6.5 + col * 3.15, y = 2.45 + row * 1.0;
    s.addShape('roundRect', {
      x, y, w: 3.0, h: 0.85,
      fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.06,
    });
    s.addText(t.t, {
      x: x + 0.15, y: y + 0.08, w: 2.7, h: 0.3,
      fontFace: 'Calibri', fontSize: 11, bold: true, color: NAVY,
    });
    s.addText(t.d, {
      x: x + 0.15, y: y + 0.4, w: 2.7, h: 0.4,
      fontFace: 'Calibri', fontSize: 9, color: '4A5A6B',
    });
  });
}

// =====================================================================
// SLIDE 12 — BENCHMARK
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'COMPETIÇÃO · MERCADO', title: 'Por que Faro AI ganha contra concorrentes', slideNum: '12 / 14' });

  // Tabela: linhas = criterios, colunas = competidores
  const header = ['Critério', 'Faro AI', 'Salesforce', 'Linx', 'DataRobot'];
  const rows = [
    ['Custo entrada',           'Open-stack',     'US$150/user',  'R$ 1k/mês',  'US$ 10k/mês'],
    ['Dataset Ford BR real',    '✓ 175k VINs',    '—',            '—',           '—'],
    ['IA explicável (sinais)',  '✓',              'Parcial',      '—',           'SHAP only'],
    ['LGPD-first',              '✓ VIN_Hash+RLS', '✓',            'Parcial',     'Parcial'],
    ['Pronto em produção',      '✓ Hoje',         '3-6 meses',    '1-2 meses',   '2-3 meses'],
    ['Integração FIPE',         '✓ Nativa',       '—',            'Parcial',     '—'],
  ];
  // header
  const ROW_H = 0.55, COL_W = [2.6, 2.6, 2.4, 2.4, 2.4];
  let cx = 0.5;
  header.forEach((h, i) => {
    s.addShape('rect', {
      x: cx, y: 1.95, w: COL_W[i], h: ROW_H,
      fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(h, {
      x: cx + 0.1, y: 1.95, w: COL_W[i] - 0.1, h: ROW_H,
      fontFace: 'Calibri', fontSize: 11, bold: true, color: WHITE,
      align: i === 0 ? 'left' : 'center', valign: 'middle',
    });
    cx += COL_W[i];
  });
  // rows
  rows.forEach((row, r) => {
    let cx2 = 0.5;
    const y = 1.95 + (r + 1) * ROW_H;
    row.forEach((cell, c) => {
      const isFaroCol = c === 1;
      s.addShape('rect', {
        x: cx2, y, w: COL_W[c], h: ROW_H,
        fill: { color: isFaroCol ? 'FFE5E8' : (r % 2 ? 'F4F7FB' : WHITE) },
        line: { color: 'E2E8F0', width: 0.5 },
      });
      s.addText(cell, {
        x: cx2 + 0.1, y, w: COL_W[c] - 0.1, h: ROW_H,
        fontFace: 'Calibri', fontSize: 10,
        bold: isFaroCol || c === 0,
        color: isFaroCol ? FERRARI : NAVY,
        align: c === 0 ? 'left' : 'center', valign: 'middle',
      });
      cx2 += COL_W[c];
    });
  });

  s.addText('5 diferenciais que ninguém entrega em conjunto:', {
    x: 0.5, y: 6.0, w: 12.3, h: 0.35,
    fontFace: 'Calibri', fontSize: 12, bold: true, color: NAVY,
  });
  s.addText('Stack brasileira · IA explicável · ML hybrid + LLM crítico · MVP em produção · LGPD by design', {
    x: 0.5, y: 6.4, w: 12.3, h: 0.35,
    fontFace: 'Calibri', fontSize: 11, italic: true, color: FERRARI,
  });
}

// =====================================================================
// SLIDE 13 — ROADMAP, RISCOS E QUALIDADE
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'PLANEJAMENTO', title: 'Roadmap, riscos e critérios de qualidade', slideNum: '13 / 14' });

  // Roadmap (timeline horizontal)
  s.addText('Roadmap', { x: 0.5, y: 1.9, w: 12, h: 0.35,
    fontFace: 'Calibri', fontSize: 14, bold: true, color: NAVY });
  const sprints = [
    { t: 'Sprint 1 ✓', d: 'MVP entregue: D1 + D2, 175k VINs, 135k leads', c: '00A896' },
    { t: 'Sprint 2', d: 'Mobile responsivo · re-treino XGBoost · onboarding', c: FORD_BLUE },
    { t: 'Sprint 3', d: 'API telematics · dashboards regionais · KPIs financeiros', c: 'F4A11A' },
    { t: 'Sprint 4', d: 'Motor de campanhas A/B · API pública pro CRM Ford', c: FERRARI },
  ];
  sprints.forEach((sp, i) => {
    const x = 0.5 + i * 3.1, y = 2.3;
    s.addShape('roundRect', {
      x, y, w: 2.95, h: 1.5,
      fill: { color: 'F4F7FB' }, line: { color: 'E2E8F0' }, rectRadius: 0.08,
    });
    s.addShape('rect', { x, y, w: 2.95, h: 0.4, fill: { color: sp.c }, line: { color: sp.c } });
    s.addText(sp.t, { x: x + 0.15, y: y + 0.05, w: 2.7, h: 0.3,
      fontFace: 'Calibri', fontSize: 12, bold: true, color: WHITE });
    s.addText(sp.d, { x: x + 0.15, y: y + 0.5, w: 2.7, h: 0.95,
      fontFace: 'Calibri', fontSize: 10, color: '2A3A4A', valign: 'top' });
  });

  // Riscos e Qualidade lado a lado
  cardBox(s, { x: 0.5, y: 4.1, w: 6.0, h: 2.5, color: FERRARI,
    label: 'PRINCIPAIS RISCOS', value: '',
    sub: '' });
  s.addText([
    { text: '▲ ', options: { color: FERRARI, bold: true } },
    { text: 'Dependência de chaves IA pagas → fallback gracioso entre OpenAI/Anthropic/Gemini\n', options: { color: '2A3A4A', fontSize: 10 } },
    { text: '▲ ', options: { color: FERRARI, bold: true } },
    { text: 'Drift do modelo → re-treino mensal automatizado\n', options: { color: '2A3A4A', fontSize: 10 } },
    { text: '▲ ', options: { color: FERRARI, bold: true } },
    { text: 'Cliente sem e-mail → captura na UI no momento da venda\n', options: { color: '2A3A4A', fontSize: 10 } },
    { text: '▲ ', options: { color: FERRARI, bold: true } },
    { text: 'Custo de envio em escala → limite por tier + opt-in LGPD', options: { color: '2A3A4A', fontSize: 10 } },
  ], { x: 0.75, y: 4.55, w: 5.5, h: 2.0, valign: 'top' });

  cardBox(s, { x: 6.8, y: 4.1, w: 6.0, h: 2.5, color: '00A896',
    label: 'CRITÉRIOS DE QUALIDADE', value: '', sub: '' });
  s.addText([
    { text: '◆ ', options: { color: '00A896', bold: true } },
    { text: 'Performance: <2s render · <1s ranking 175k leads\n', options: { color: '2A3A4A', fontSize: 10 } },
    { text: '◆ ', options: { color: '00A896', bold: true } },
    { text: 'Segurança: RLS · HMAC · audit log LGPD\n', options: { color: '2A3A4A', fontSize: 10 } },
    { text: '◆ ', options: { color: '00A896', bold: true } },
    { text: 'Usabilidade: ≤4 cliques pra ação · 100% PT-BR\n', options: { color: '2A3A4A', fontSize: 10 } },
    { text: '◆ ', options: { color: '00A896', bold: true } },
    { text: 'Observabilidade: 100% das chamadas IA rastreadas', options: { color: '2A3A4A', fontSize: 10 } },
  ], { x: 7.05, y: 4.55, w: 5.5, h: 2.0, valign: 'top' });
}

// =====================================================================
// SLIDE 14 — ENCERRAMENTO / KPIS
// =====================================================================
{
  const s = pres.addSlide();
  addSlideTitle(s, { eyebrow: 'CONCLUSÃO · KPIS DE SUCESSO', title: 'Métricas que provam o impacto', slideNum: '14 / 14', isDark: true });

  const kpis = [
    { v: '+3 pp', l: 'VIN SHARE EM 6 MESES', c: FERRARI },
    { v: '>15%', l: 'CONVERSÃO LEAD → REVISÃO', c: ICE },
    { v: '<500ms', l: 'LATÊNCIA API p95', c: ICE },
    { v: '99,5%', l: 'DISPONIBILIDADE', c: '00A896' },
    { v: '>70', l: 'NPS DO VENDEDOR', c: ICE },
    { v: '< US$0,05', l: 'CUSTO MÉDIO CLASSIFICAÇÃO IA', c: FERRARI },
  ];
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 4.2, y = 2.0 + row * 1.7;
    s.addShape('roundRect', {
      x, y, w: 4.0, h: 1.5,
      fill: { color: NAVY_2 }, line: { color: '20354A' }, rectRadius: 0.1,
    });
    s.addText(k.v, {
      x: x + 0.3, y: y + 0.15, w: 3.5, h: 0.7,
      fontFace: 'Calibri', fontSize: 32, bold: true, color: k.c,
    });
    s.addText(k.l, {
      x: x + 0.3, y: y + 0.95, w: 3.5, h: 0.4,
      fontFace: 'Calibri', fontSize: 10, bold: true, color: ICE, charSpacing: 4,
    });
  });

  // Tagline final
  s.addText('AI que tem faro pro cliente certo.', {
    x: 0.5, y: 5.8, w: 12.3, h: 0.7,
    fontFace: 'Calibri', fontSize: 30, bold: true, italic: true,
    color: WHITE, align: 'center',
  });
  s.addText('Faro AI · Ford × FIAP Challenge 2026 · 24/05/2026', {
    x: 0.5, y: 6.6, w: 12.3, h: 0.3,
    fontFace: 'Calibri', fontSize: 11,
    color: ICE, align: 'center',
  });
}

// =====================================================================
// SAVE
// =====================================================================
await pres.writeFile({ fileName: OUT });
console.log(`✅ Apresentação gerada: ${OUT}`);
