/**
 * Chaves e tipos para o estado persistido da aplicação no SQLite.
 *
 * O appState é um armazenamento chave-valor genérico no processo principal.
 * Agrupa chaves nomeadas por domínio (romImport, media, dataPortability)
 * para evitar colisões e facilitar leitura e manutenção.
 */

/** Mapa hierárquico de todas as chaves de estado da aplicação, organizadas por domínio. */
export const APP_STATE_KEYS = {
  romImport: {
    /** Caminhos de pastas e arquivos de ROM configurados para importação. */
    sources: "gamestock.romImport.sources",
    /** ID da plataforma selecionada no importador de pastas de ROM. */
    platformId: "gamestock.romImport.platformId",
    /** Entradas de pastas de ROM cadastradas na biblioteca. */
    folderEntries: "gamestock.romImport.folderEntries"
  },
  media: {
    /** Último job de importação de ROMs por pasta concluído ou interrompido. */
    lastRomImportJob: "gamestock.media.lastRomImportJob",
    /** Último job de sincronização de mídia (covers) concluído ou interrompido. */
    lastMediaSyncJob: "gamestock.media.lastMediaSyncJob",
    /** Lista de todos os jobs de sincronização de mídia já executados. */
    lastMediaSyncJobs: "gamestock.media.lastMediaSyncJobs"
  },
  dataPortability: {
    /** Lista de jobs de exportação/importação de portabilidade de dados. */
    jobs: "gamestock.dataPortability.jobs"
  }
} as const;

/**
 * União de todos os valores literais de string dentro de APP_STATE_KEYS.
 * Permite tipar parâmetros de chave de forma segura sem repetir os strings manualmente.
 */
export type AppStateKey = ValueOfNested<typeof APP_STATE_KEYS>;

/** Representa uma entrada individual do armazenamento chave-valor de estado da aplicação. */
export interface AppStateEntry {
  /** Chave tipada ou string arbitrária para chaves não mapeadas. */
  key: AppStateKey | string;
  /** Valor associado; pode ser qualquer estrutura serializável em JSON. */
  value: unknown;
}

/**
 * Utilitário de tipo recursivo que extrai todos os tipos string
 * aninhados dentro de um objeto (ou do próprio tipo, se já for string).
 * Usado para derivar AppStateKey automaticamente a partir de APP_STATE_KEYS.
 */
type ValueOfNested<T> = T extends string
  ? T
  : T extends Record<string, infer U>
    ? ValueOfNested<U>
    : never;
