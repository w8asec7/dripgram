import { useLocalSearchParams } from "expo-router";
import { GarmentForm } from "../../features/GarmentForm";
export default function PhotoGarment() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  return (
    <GarmentForm
      initialSource={
        source === "camera" || source === "library" ? source : undefined
      }
    />
  );
}
