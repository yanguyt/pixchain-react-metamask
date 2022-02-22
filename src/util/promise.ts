export const pDebounce = (fn: any, wait: number, options: Record<string, any> = {}) => {
  if (!Number.isFinite(wait)) {
    throw new TypeError('Expected `wait` to be a finite number');
  }

  let leadingValue: any;
  let timeout: NodeJS.Timeout;
  let resolveList: any[] = [];
  /**
   * @constructor
   * @this Test
   */
  return function (this: any, ...arguments_: any[]) {
    return new Promise((resolve) => {
      const shouldCallNow = options.before && !timeout;

      clearTimeout(timeout);

      timeout = setTimeout(() => {
        clearTimeout(timeout);

        const result = options.before ? leadingValue : fn.apply(this, arguments_);

        for (resolve of resolveList) {
          resolve(result);
        }

        resolveList = [];
      }, wait);

      if (shouldCallNow) {
        leadingValue = fn.apply(this, arguments_);
        resolve(leadingValue);
      } else {
        resolveList.push(resolve);
      }
    });
  };
};

pDebounce.promise = (function_: any) => {
  let currentPromise: any;

  return async function (this: any, ...arguments_: any[]) {
    if (currentPromise) {
      return currentPromise;
    }

    try {
      currentPromise = function_.apply(this, arguments_);
      return await currentPromise;
    } finally {
      currentPromise = undefined;
    }
  };
};
