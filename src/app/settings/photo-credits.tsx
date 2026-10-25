import React from "react";
import { Screen, Txt, Card, Button } from "../../components/ui";
import { Linking } from "react-native";
import { useApp } from "../../state/AppProvider";
import sources from "../../../assets/photography/sources.json";
export default function PhotoCredits() {
  const { toast } = useApp();
  const openExternal = (url: string) =>
    Linking.openURL(url).catch(() =>
      toast("Could not open this link. Try again."),
    );
  return (
    <Screen
      back
      title="Photography credits"
      subtitle="Real photos. Clearly labeled samples."
    >
      <Txt muted>
        Demo closet images are representative photographs, not photos of your
        exact belongings. Sample accounts are fictional. Photographers, people
        and brands shown do not endorse DripGram. Real-account uploads are
        preserved. Designated local demo QA originals are archived before
        representative photos are applied.
      </Txt>
      {sources.map((p) => (
        <Card key={p.key}>
          <Txt style={{ fontWeight: "600" }}>{p.key.replaceAll("-", " ")}</Txt>
          <Txt muted>Photo: {p.author} / Pexels</Txt>
          <Button
            title={`View source: ${p.key}`}
            variant="ghost"
            onPress={() => void openExternal(p.source)}
          />
        </Card>
      ))}
      <Button
        title="Pexels license"
        onPress={() => void openExternal("https://www.pexels.com/license/")}
      />
    </Screen>
  );
}
