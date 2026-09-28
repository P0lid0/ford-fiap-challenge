/**
 * Ponto único de acesso à camada de dados.
 * As telas importam daqui — nunca de ApiDataSource/LocalDataSource diretamente.
 */
import { AppConfig } from '../config';
import { ApiDataSource } from './ApiDataSource';
import type { DataSource } from './DataSource';
import { LocalDataSource } from './LocalDataSource';

function createDataSource(): DataSource {
  return AppConfig.dataMode === 'local' ? new LocalDataSource() : new ApiDataSource();
}

export const dataSource: DataSource = createDataSource();

export { DataSourceError } from './DataSource';
export type { DataMode, DataSource, DataSourceErrorCode } from './DataSource';
export { DEMO_CREDENTIALS } from './LocalDataSource';
