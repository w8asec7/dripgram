import React, { useRef, useState } from "react";
import { Button, Txt } from "../../components/ui";
import type { Outfit } from "../../models";
import { useApp, friendlyError } from "../../state/AppProvider";
/** Preference feedback only. Never issues wear/laundry/inventory commands. */
export function OutfitFeedbackButtons({
  outfit,
  disabled = false,
}: {
  outfit: Outfit;
  disabled?: boolean;
}) {
  const { data, execute, busy } = useApp();
  const feedback = data?.outfitFeedback.find((f) => f.outfitId === outfit.id);
  const lock = useRef(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const respond = async (response: "wore" | "did-not-wear") => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await execute({
        type: "outfit.feedback",
        outfit,
        response: feedback?.response === response ? null : response,
      });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <Button
        compact
        title="Wore This"
        selected={feedback?.response === "wore"}
        accessibilityLabel={
          feedback?.response === "wore" ? "Undo Wore This" : "Wore This"
        }
        variant={feedback?.response === "wore" ? "primary" : "secondary"}
        disabled={disabled || busy || pending}
        onPress={() => void respond("wore")}
      />
      <Button
        compact
        title="Didn't Wear This"
        selected={feedback?.response === "did-not-wear"}
        accessibilityLabel={
          feedback?.response === "did-not-wear"
            ? "Undo Didn't Wear This"
            : "Didn't Wear This"
        }
        variant={feedback?.response === "did-not-wear" ? "primary" : "ghost"}
        disabled={disabled || busy || pending}
        onPress={() => void respond("did-not-wear")}
      />
      {!!feedback && (
        <Txt
          muted
          accessibilityLiveRegion="polite"
          style={{ fontSize: 11, width: "100%" }}
        >
          Feedback saved · Tap your response again to undo.
        </Txt>
      )}
      {!!error && (
        <Txt accessibilityRole="alert" style={{ fontSize: 12, width: "100%" }}>
          {error}
        </Txt>
      )}
    </>
  );
}
