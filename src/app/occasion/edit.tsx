import { useLocalSearchParams } from "expo-router";
import { OccasionForm } from "../../features/OccasionForm";
import { useApp } from "../../state/AppProvider";
import { Screen, Empty } from "../../components/ui";
export default function EditOccasion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user } = useApp();
  const occasion = data?.occasions.find(
    (o) => o.id === id && o.ownerId === user?.id,
  );
  return occasion ? (
    <OccasionForm occasion={occasion} />
  ) : (
    <Screen back>
      <Empty
        title="Occasion unavailable"
        body="Only the host can edit occasion details."
      />
    </Screen>
  );
}
