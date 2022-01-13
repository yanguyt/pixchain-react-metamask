import { useEthers } from '@usedapp/core';
import axios from 'axios';
import pMemoize from 'p-memoize';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Context } from '.';
import {
  BlockchainCallableEnum,
  ContractDeployCallable,
  ContractTransactionCallable,
  PaginationResponse,
  Transaction,
} from './interfaces';
import { StateStorage } from './util';
import { deployContract, sendTransaction } from './util/blockchain';
import { fetcher } from './util/fetcher';

export const useWallet = () => {
  const { account: address, chainId, library, active, activate, activateBrowserWallet, deactivate } = useEthers();

  return {
    address,
    chainId,
    library,
    active,
    activate,
    activateBrowserWallet,
    deactivate,
  };
};

export const useSigning = (props: { pendingTransactionsEndpoint: string; auto?: boolean }) => {
  const store = useMemo(() => new StateStorage(), []);
  const isBrowser = !!(process as any).browser;
  const { address, chainId, library, active } = useWallet();
  const [autoSign, setAutoSign] = useState(!!props.auto);
  const { state, dispatch } = useContext(Context);

  const { data } = useSWR<PaginationResponse<Transaction>>(
    `${props.pendingTransactionsEndpoint}?address=${address}&chainId=${chainId}`,
    address && chainId ? fetcher : null,
    {
      refreshInterval: 5000,
      isPaused: () => !address || !chainId,
    },
  );

  const pendingTransactions = useMemo(() => data?.items ?? [], [data?.items]);
  const hasPending = Object?.keys(state.pending).length > 0;

  // Send transaction acknowledgement to the backend.
  const notify = useCallback(
    pMemoize(async (id: Transaction['id'], txHash: string) => {
      try {
        await axios.patch(`/api/ack-transaction?id=${id}&txhash=${txHash}`, { txHash });
        console.debug(`Transaction notified: ${id} - Hash: ${txHash}`);
      } catch (error) {
        console.error(error);
      }
    }),
    [],
  );

  // Use Metamask to sign and send the transaction.
  const sendSignedRequest = useCallback(
    async (transaction: Transaction) => {
      try {
        const response = await sendTransaction(transaction.data as ContractTransactionCallable, library?.getSigner());

        const txHash = response.hash;
        dispatch({ type: 'TRANSACTION_SENT', payload: { id: transaction.id, txHash: txHash } });
        console.debug(`Transaction send: ${transaction.id} - Hash: ${txHash}`);
      } catch (error) {
        dispatch({ type: 'ABORT_SIGNING', payload: { id: transaction.id } });
        console.error(error);
      }
    },
    [dispatch, library, state],
  );

  // Use Metamask to sign and send the deploy contract.
  const sendSignedDeployRequest = useCallback(
    async (transaction: Transaction) => {
      try {
        const response = await deployContract(transaction.data as ContractDeployCallable, library?.getSigner());
        const txHash = response.deployTransaction.hash;
        dispatch({ type: 'TRANSACTION_SENT', payload: { id: transaction.id, txHash: txHash } });
        console.debug(`Transaction send: ${transaction.id} - Hash: ${txHash}`);
      } catch (error) {
        dispatch({ type: 'ABORT_SIGNING', payload: { id: transaction.id } });
        console.error(error);
      }
    },
    [dispatch, library, state],
  );

  const requestPendingSignature = () => {
    const [transaction] = Object.values(state.pending);

    if (active && transaction) {
      dispatch({ type: 'REQUEST_SIGNING', payload: transaction });
    }
  };

  useEffect(() => {
    pendingTransactions.forEach((transaction) => {
      const alreadyProcess =
        state.pending[transaction.id] || state.sent[transaction.id] || state.notified[transaction.id];

      if (alreadyProcess) {
        return;
      }

      dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
    });
  }, [pendingTransactions, dispatch, state.pending, state.sent, state.notified]);

  // If auto mode is enabled, request signing of the current transaction.
  useEffect(() => {
    if (autoSign && hasPending && !state.current) {
      requestPendingSignature();
    }
  }, [active, autoSign, sendSignedRequest, state.current]);

  // Request Metamask signing for current transaction.
  useEffect(() => {
    if (hasPending && state.current) {
      // Handle transaction or deploy
      if (state.current.data.type === BlockchainCallableEnum.TRANSACTION) {
        sendSignedRequest(state.current);
      } else {
        sendSignedDeployRequest(state.current);
      }
    }
  }, [dispatch, hasPending, state.current]);

  // Notify the backend with all transactions sent to the blockchain.
  useEffect(() => {
    const transactionsSent = Object.entries(state.sent);
    if (transactionsSent.length) {
      transactionsSent.forEach(([id, txHash]) => {
        if (id && txHash && !state.notified[id]) {
          notify(id, txHash).then(() => {
            dispatch({ type: 'TRANSACTION_NOTIFIED', payload: { id } });
          });
        } else {
          console.debug('Already notified', id, txHash);
        }
      });
    }
  }, [state]);

  useEffect(() => {
    isBrowser && store.save(state);
  }, [state]);

  useEffect(() => {
    isBrowser && dispatch({ type: 'UPDATE_STATE', payload: store.get() });
  }, []);

  return {
    address,
    chainId,
    library,
    active,
    hasPending,
    pendingTransactions,
    dispatch,
    state,
    toggleAutoSign: () => setAutoSign((prevState) => !prevState),
    autoSign,
    // requestSigning,
    requestPendingSignature,
  };
};
