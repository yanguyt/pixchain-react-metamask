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

export const Provider: React.FC = ({ children }): JSX.Element => {
  const [config] = useState<Config>({
    autoConnect: false,
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

export const SayHello = ({ name }: { name: string }): JSX.Element => {
  const [g] = useState('Maldito beta-16');
  return (
    <div>
      Hey {name}, go hello to TypeScript {g}.
    </div>
  );
};
