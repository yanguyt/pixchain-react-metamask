import { State } from '../interfaces';

export class StateStorage {
  private CACHE_KEY = 'SIGNING_REDUCER_STATE';

  save(state: State) {
    if (globalThis?.localStorage) {
      globalThis.localStorage.setItem(this.CACHE_KEY, JSON.stringify(state));
    }
  }

  get() {
    if (globalThis?.localStorage) {
      try {
        const stored = globalThis.localStorage.getItem(this.CACHE_KEY);

        return !!stored ? JSON.parse(stored) : StateStorage.default();
      } catch (error) {
        return StateStorage.default();
      }
    } else {
      StateStorage.default();
    }
  }

  public static default(): State {
    return Object.assign(
      {},
      {
        notified: {},
        sent: {},
        pending: {},
        current: null,
      },
    );
  }
}
