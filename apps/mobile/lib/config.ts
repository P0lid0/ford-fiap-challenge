/**
 * Configuração do app, lida das variáveis EXPO_PUBLIC_* (embutidas no build).
 *
 *  EXPO_PUBLIC_DATA_MODE = 'api' | 'local'   (padrão: 'api')
 *     api   → consome a API REST (apps/api)
 *     local → dados de demonstração embutidos (usado no APK de entrega — ver eas.json)
 *
 *  EXPO_PUBLIC_API_URL = URL base da API     (padrão: http://localhost:3333)
 */
import type { DataMode } from './data/DataSource';

function readDataMode(): DataMode {
  return process.env.EXPO_PUBLIC_DATA_MODE === 'local' ? 'local' : 'api';
}

function readApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333';
  return url.replace(/\/+$/, ''); // sem barra no final
}

export const AppConfig = {
  dataMode: readDataMode(),
  apiUrl: readApiUrl(),
  requestTimeoutMs: 15_000,
  /** Chamadas que geram texto com IA podem levar mais tempo. */
  aiRequestTimeoutMs: 45_000,
} as const;
