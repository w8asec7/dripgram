import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
jest.mock("../../src/state/AppProvider", () => ({
  friendlyError: (e: Error) => e.message,
}));
test("changed requests show loading and ignore late results from the previous loader", async () => {
  let firstResolve!: (value: string) => void,
    secondResolve!: (value: string) => void;
  const first = () =>
    new Promise<string>((resolve) => {
      firstResolve = resolve;
    });
  const second = () =>
    new Promise<string>((resolve) => {
      secondResolve = resolve;
    });
  const { result, rerender } = await renderHook<
    ReturnType<typeof useAsyncResource<string>>,
    { loader: () => Promise<string> }
  >(({ loader }) => useAsyncResource(loader), {
    initialProps: { loader: first },
  });
  expect(result.current.loading).toBe(true);
  await rerender({ loader: second });
  await act(() => firstResolve("stale"));
  expect(result.current.value).toBeNull();
  expect(result.current.loading).toBe(true);
  await act(() => secondResolve("current"));
  expect(result.current.value).toBe("current");
  expect(result.current.loading).toBe(false);
});
test("failed resources expose an error and a successful retry clears it", async () => {
  const loader = jest
    .fn<Promise<string>, []>()
    .mockRejectedValueOnce(new Error("Offline fixture"))
    .mockResolvedValueOnce("recovered");
  const { result } = await renderHook(() => useAsyncResource(loader));
  await waitFor(() => expect(result.current.error).toBe("Offline fixture"));
  expect(result.current.loading).toBe(false);
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.value).toBe("recovered"));
  expect(result.current.error).toBe("");
  expect(loader).toHaveBeenCalledTimes(2);
});
