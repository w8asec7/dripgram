import { useLocalSearchParams } from "expo-router";
import { GarmentForm } from "../../features/GarmentForm";
import { useApp } from "../../state/AppProvider";
import { Screen, Empty } from "../../components/ui";
export default function EditGarment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useApp();
  const g = data?.garments.find((g) => g.id === id);
  return g ? (
    <GarmentForm garment={g} />
  ) : (
    <Screen back>
      <Empty
        title="Piece not found"
        body="This garment may have been removed."
      />
    </Screen>
  );
}
