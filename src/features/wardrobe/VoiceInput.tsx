import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, Linking } from "react-native";
import {
  useAudioStream,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Button, Card, Txt, ignore } from "../../components/ui";
import { cleanupTemporaryImage } from "../../services/images";
export function VoiceInput({
  transcribe,
  onText,
  disabled,
}: {
  transcribe: (base64: string) => Promise<{ text: string }>;
  onText: (text: string) => void;
  disabled: boolean;
}) {
  const { stream, isStreaming } = useAudioStream({
    sampleRate: 24000,
    channels: 1,
    encoding: "int16",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    interval = useRef<ReturnType<typeof setInterval> | null>(null),
    uri = useRef<string | null>(null),
    lock = useRef(false),
    active = useRef(true);
  const finishRef = useRef<() => Promise<void>>(async () => undefined);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
  }, []);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clear();
      stream.stop();
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (uri.current) void cleanupTemporaryImage(uri.current);
    };
  }, [stream, clear]);
  const finish = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    clear();
    setError("");
    try {
      const recorded = await stream.stopFileRecordingAsync();
      stream.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const base64 = await FileSystem.readAsStringAsync(recorded.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await transcribe(base64);
      if (active.current) onText(result.text);
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not transcribe this recording. Try typing your list.",
        );
    } finally {
      stream.stop();
      if (uri.current)
        await cleanupTemporaryImage(uri.current).catch(() => undefined);
      uri.current = null;
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }, [stream, transcribe, onText, clear]);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);
  const start = async () => {
    if (disabled || busy || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const existing = await getRecordingPermissionsAsync();
      const permission =
        existing.status === "undetermined"
          ? await requestRecordingPermissionsAsync()
          : existing;
      if (!permission.granted)
        throw new Error(
          "Microphone access is off. Enable it in Settings, or type your clothing list below.",
        );
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await stream.start();
      const file = await stream.startFileRecordingAsync({
        format: "wav",
        directory: "cache",
      });
      uri.current = file.uri;
      setSeconds(0);
      interval.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      timer.current = setTimeout(() => void finishRef.current(), 30000);
    } catch (e) {
      stream.stop();
      setError(
        e instanceof Error
          ? e.message
          : "Microphone unavailable. Text entry still works.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (Platform.OS === "web")
    return (
      <Card>
        <Txt muted>
          Voice recording is available in Expo Go on iPhone/Android. You can
          also use your keyboard’s dictation to fill the text field below.
        </Txt>
      </Card>
    );
  return (
    <Card>
      <Txt style={{ fontWeight: "600" }}>Describe a few pieces at once.</Txt>
      <Txt muted>
        Up to30 seconds. Audio goes to Meta for transcription, then is
        discarded. Review the transcript before extracting clothes.
      </Txt>
      <Button
        title={
          isStreaming
            ? `Stop & transcribe · ${seconds}s`
            : "Start voice description"
        }
        icon={isStreaming ? "square" : "mic"}
        loading={busy}
        disabled={disabled}
        onPress={() => void (isStreaming ? finish() : start())}
      />
      {!!error && (
        <>
          <Txt accessibilityRole="alert">{error}</Txt>
          <Button
            title="Open microphone settings"
            variant="ghost"
            onPress={() => ignore(Linking.openSettings())}
          />
        </>
      )}
    </Card>
  );
}
