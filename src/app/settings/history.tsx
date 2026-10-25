import { Redirect } from "expo-router";
/** Legacy deep links retain a safe destination; historical records are untouched. */
export default function RetiredInventoryRoute() {
  return <Redirect href="/(tabs)/closet" />;
}
