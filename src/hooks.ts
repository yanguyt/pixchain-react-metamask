import { useEthers } from '@usedapp/core';
import pMemoize from 'p-memoize';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Context } from '.';
import { BlockchainCallableEnum, ContractDeployCallable, ContractTransactionCallable, Transaction } from './interfaces';
import { StateStorage } from './util';
import { deployContract, sendTransaction } from './util/blockchain';

export interface Props {
  auto?: boolean;
  onReceiveTransaction?: (transaction: Transaction) => void;
  persist?: boolean;
  autoload?: boolean;
  handleNotify?: (id: Transaction['id'], txHash: string) => Promise<unknown>;
  debug?: boolean;
}

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

// eslint-disable-next-line sonarjs/cognitive-complexity
export const useSigning = (props: Props) => {
  const store = useMemo(() => new StateStorage(), []);
  const isBrowser = !!(process as any).browser;
  const { address, chainId, library, active } = useWallet();
  const [autoSign, setAutoSign] = useState(!!props.auto);
  const { state, dispatch } = useContext(Context);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const hasPending = Object?.keys(state.pending).length > 0;

  useEffect(() => {
    props.persist && isBrowser && store.save(state);
  }, [isBrowser, props.persist, state, store]);

  useEffect(() => {
    props.autoload && isBrowser && dispatch({ type: 'UPDATE_STATE', payload: store.get() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send transaction acknowledgement to the backend.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notify = useCallback(
    // Use p-memoize to memoize the function.
    pMemoize(
      props.handleNotify ||
        (async () => {
          return null;
        }),
      { cachePromiseRejection: false },
    ),
    [props.handleNotify],
  );

  // Use Metamask to sign and send the transaction.
  const sendSignedRequest = useCallback(
    async (transaction: Transaction) => {
      try {
        const response = await sendTransaction(transaction.data as ContractTransactionCallable, library?.getSigner());

        const txHash = response.hash;
        dispatch({ type: 'TRANSACTION_SENT', payload: { id: transaction.id, txHash: txHash } });
      } catch (error) {
        dispatch({ type: 'ABORT_SIGNING', payload: { id: transaction.id } });
        console.error(error);
      }
    },
    [dispatch, library],
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

  const requestPendingSignature = useCallback(() => {
    const [transaction] = Object.values(state.pending);

    if (active && transaction) {
      dispatch({ type: 'REQUEST_SIGNING', payload: transaction });
    }
  }, [active, dispatch, state.pending]);

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
    transactions.forEach((transaction) => addTransaction(transaction));
  }, [addTransaction, transactions]);

  // If auto mode is enabled, request signing of the current transaction.
  useEffect(() => {
    if (autoSign && hasPending && !state.current) {
      requestPendingSignature();
    }
  }, [autoSign, hasPending, requestPendingSignature, state]);

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
    setTransactions,
    transactions,
  };
};
