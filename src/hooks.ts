import { useEthers } from '@usedapp/core';
import pMemoize from 'p-memoize';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Context } from '.';
import { BlockchainCallableEnum, ContractDeployCallable, ContractTransactionCallable, Transaction } from './interfaces';
import { StateStorage } from './util';
import { deployContract, sendTransaction } from './util/blockchain';
import { pDebounce } from './util/promise';

export interface Props {
  auto?: boolean;
  onReceiveTransaction?: (transaction: Transaction) => void;
  persist?: boolean;
  autoload?: boolean;
  handleNotify?: (id: Transaction['id'], txHash: string) => Promise<unknown>;
  onRejectTransaction?: (transaction: Transaction) => Promise<unknown>;
}

export const useWallet = () => {
  const { account: address, chainId, library, active, activate, activateBrowserWallet, deactivate } = useEthers();

  return {
    address: address?.toLowerCase(),
    chainId,
    library,
    active,
    activate,
    activateBrowserWallet,
    deactivate,
  };
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const useSigning = (props: Props) => {
  const store = useMemo(() => new StateStorage(), []);
  const isBrowser = !!(process as any).browser;
  const { address, chainId, library, active } = useWallet();
  const [autoSign, setAutoSign] = useState(!!props.auto);
  const { state, dispatch } = useContext(Context);
  const [processing, setProcessing] = useState(false);

  const hasPending = Object?.keys(state.pending).length > 0;

  // Send transaction acknowledgement to the backend.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notify = useCallback(
    // Use p-memoize to memoize the function.
    pMemoize(props.handleNotify || (async () => null), { cachePromiseRejection: false }),
    [props.handleNotify],
  );

  // Use Metamask to sign and send the transaction.
  const sendSignedRequest = useCallback(
    async (transaction: Transaction) => {
      try {
        const response = await sendTransaction(transaction.data as ContractTransactionCallable, library?.getSigner());

        const txHash = response.hash;
        dispatch({ type: 'TRANSACTION_SENT', payload: { id: transaction.id, txHash } });
      } catch (error) {
        dispatch({ type: 'ABORT_SIGNING', payload: { id: transaction.id } });
        if (props.onRejectTransaction) {
          await props.onRejectTransaction(transaction);
        }
        throw error;
      }
    },
    [dispatch, library, props.onRejectTransaction],
  );

  // Use Metamask to sign and send the deploy contract.
  const sendSignedDeployRequest = useCallback(
    async (transaction: Transaction) => {
      try {
        const response = await deployContract(transaction.data as ContractDeployCallable, library?.getSigner());
        const txHash = response.deployTransaction.hash;
        dispatch({ type: 'TRANSACTION_SENT', payload: { id: transaction.id, txHash: txHash } });
      } catch (error) {
        dispatch({ type: 'ABORT_SIGNING', payload: { id: transaction.id } });
        console.error(error);
      }
    },
    [dispatch, library],
  );

  const rejectTransaction = useCallback(
    (id: Transaction['id']) => {
      dispatch({ type: 'ABORT_SIGNING', payload: { id } });
    },
    [dispatch],
  );

  const requestPendingSignature = useCallback(() => {
    const [transaction] = Object.values(state.pending);

    if (transaction && !state.current) {
      dispatch({ type: 'REQUEST_SIGNING', payload: transaction });
    }
  }, [dispatch, state.pending, state.current]);

  const addTransaction = useCallback(
    (transaction: Transaction) => {
      const alreadyProcessed =
        state.pending[transaction.id] || state.sent[transaction.id] || state.notified[transaction.id];

      if (alreadyProcessed) {
        return;
      }

      dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
      if (props.onReceiveTransaction) {
        props.onReceiveTransaction(transaction);
      }
    },
    [state.pending, state.sent, state.notified, dispatch, props],
  );

  useEffect(() => {
    /* This is saving the state to the local storage. */
    props.persist && isBrowser && store.save(state);
  }, [isBrowser, props.persist, state, store]);

  useEffect(() => {
    // Load the state from the store.
    props.autoload && isBrowser && dispatch({ type: 'UPDATE_STATE', payload: store.get() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // If auto mode is enabled, request signing of the current transaction.
    if (autoSign && hasPending && !state.current) {
      requestPendingSignature();
    }
  }, [autoSign, hasPending, requestPendingSignature, state]);

  const sendSignRequest = useCallback(
    pDebounce(async (transaction: Transaction) => {
      if (!transaction) {
        return;
      }
      try {
        setProcessing(true);
        // Handle transaction or deploy
        if (transaction.data.type === BlockchainCallableEnum.TRANSACTION) {
          await sendSignedRequest(transaction);
        } else {
          await sendSignedDeployRequest(transaction);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setProcessing(false);
      }
    }, 200),
    [sendSignedDeployRequest, sendSignedRequest],
  );

  // Request Metamask signing for current transaction.
  useEffect(() => {
    if (hasPending && state.current && active && !processing) {
      sendSignRequest(state.current);
    }
  }, [hasPending, sendSignedDeployRequest, sendSignedRequest, state]);

  // Notify the backend with all transactions sent to the blockchain.
  useEffect(() => {
    const transactionsSent = Object.entries(state.sent);
    if (transactionsSent.length) {
      transactionsSent.forEach(([id, txHash]) => {
        if (id && txHash && !state.notified[id]) {
          notify(id, txHash)
            .then(() => {
              dispatch({ type: 'TRANSACTION_NOTIFIED', payload: { id } });
            })
            .catch((err) => console.error(err));
        }
      });
    }
  }, [dispatch, notify, state]);

  return {
    address,
    chainId,
    library,
    active,
    hasPending,
    dispatch,
    state,
    toggleAutoSign: () => setAutoSign((prevState) => !prevState),
    autoSign,
    requestPendingSignature,
    rejectTransaction,
    addTransaction,
    processing,
  };
};
