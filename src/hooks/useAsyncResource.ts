import { useEffect, useState } from "react";
import { friendlyError } from "../state/AppProvider";
/** Pass a useCallback loader. A changed request derives loading immediately. */
export function useAsyncResource<T>(loader: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    loader: typeof loader;
    revision: number;
    value: T | null;
    error: string;
    loading: boolean;
  }>({ loader, revision, value: null, error: "", loading: true });
  const current = state.loader === loader && state.revision === revision;
  useEffect(() => {
    let active = true;
    loader()
      .then((value) => {
        if (active)
          setState({ loader, revision, value, error: "", loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            loader,
            revision,
            value: null,
            error: friendlyError(error),
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [loader, revision]);
  return {
    value: current ? state.value : null,
    loading: !current || state.loading,
    error: current ? state.error : "",
    retry: () => setRevision((n) => n + 1),
  };
}
