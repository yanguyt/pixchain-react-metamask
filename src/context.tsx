import { Config, DAppProvider } from '@usedapp/core';
import React, { createContext, useReducer, useState } from 'react';
import { State } from './interfaces';
import { reducer, ReducerActions } from './reducer';
import { StateStorage } from './util';

export interface ContextValue {
  state: State;
  dispatch: React.Dispatch<ReducerActions>;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const Context = createContext<ContextValue>(null!);

export const Provider: React.FC<{ dappConfig?: Config }> = ({ children, dappConfig }): JSX.Element => {
  const [config] = useState<Config>({
    autoConnect: true,
    ...(dappConfig ?? {}),
  });
  const [state, dispatch] = useReducer(reducer, StateStorage.default());

  return (
    <>
      <DAppProvider config={config}>
        <Context.Provider value={{ state, dispatch }}>{children}</Context.Provider>
      </DAppProvider>
    </>
  );
};
