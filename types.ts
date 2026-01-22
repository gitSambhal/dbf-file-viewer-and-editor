
export interface DBFField {
  name: string;
  type: string;
  length: number;
  decimalCount: number;
}

export interface DBFHeader {
  version: number;
  lastUpdate: Date;
  numberOfRecords: number;
  headerLength: number;
  recordLength: number;
  fields: DBFField[];
}

export type DBFRow = Record<string, any>;

export interface DBFData {
  id: string;
  header: DBFHeader;
  rows: DBFRow[];
  fileName: string;
  hiddenColumns: string[];
}

export interface RangeFilter {
  mode: 'all' | 'first' | 'last' | 'range';
  count: number;
  from: number;
  to: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  READY = 'READY',
  ERROR = 'ERROR'
}
