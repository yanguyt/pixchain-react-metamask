export enum BlockchainCallableEnum {
  CALL = 'call',
  TRANSACTION = 'transaction',
  DEPLOYMENT = 'deployment',
}

export type State = {
  current: Transaction | null;
  pending: Record<Transaction['id'], Transaction>;
  sent: Record<Transaction['id'], string>;
  notified: Record<Transaction['id'], Date>;
};

export interface TransactionInput {
  name: string;
  type: string;
}
export interface Abi {
  name: string;
  type: string;
  inputs: TransactionInput[];
  outputs: any[];
  payable: boolean;
  constant: boolean;
}
export interface TransactionArgument {
  name: string;
  type: string;
  index: number;
  value: any;
}
export interface ContractTransactionCallable {
  methodName: string;
  arguments: TransactionArgument[];
  argumentValues: any[];
  outputs: any[];
  abi: Abi;
  signature: string;
  contractAddress: string;
  type: BlockchainCallableEnum.TRANSACTION;
}
export interface ContractDeployCallable {
  methodName: 'deploy';
  signature: string[];
  bytecode: string;
  argumentValues: any[];
  type: BlockchainCallableEnum.DEPLOYMENT;
}
export type TransactionData = ContractTransactionCallable | ContractDeployCallable;
export interface Transaction {
  status: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  address: string;
  chainId: number;
  data: TransactionData;
  txHash?: any;
  externalId?: any;
  source: string;
  signedAt?: any;
  expiredAt?: any;
  expireAt: Date;
}
export interface Signer {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  type: string;
  address: string;
  chainId: number;
  data: any;
}
export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}
export interface PaginationResponse<T = any> {
  items: T[];
  meta: PaginationMeta;
}
export interface Contract {
  id: string;
  description: string;
  uniqueName: string;
  lastContractSourceId?: string;
}
export interface Deploy {
  contractSourceId: string;
  chainId: number;
  from: string;
  argumentValues: unknown[];
}
