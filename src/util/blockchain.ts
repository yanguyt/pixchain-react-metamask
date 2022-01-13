import { ContractTransaction, ethers } from 'ethers';
import {
    ContractDeployCallable,
    ContractTransactionCallable
} from '../interfaces';

export const sendTransaction = async (params: ContractTransactionCallable, signerOrProvider?: any) => {
    const contract = new ethers.Contract(params.contractAddress, [params.signature], signerOrProvider);
    const contractMethod = params.methodName;
    const contractArgs = params.argumentValues;
    const result: ContractTransaction = await contract.functions[contractMethod](...contractArgs);
    return result;
};

export const deployContract = async (params: ContractDeployCallable, signerOrProvider?: any) => {
    const contractArgs = params.argumentValues;
    const contractFactory = new ethers.ContractFactory(params.signature, params.bytecode, signerOrProvider);
    const contract: ethers.Contract = await contractFactory.deploy(...contractArgs);
    return contract;
};