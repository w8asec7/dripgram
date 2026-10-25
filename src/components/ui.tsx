import { apiRequest } from "../services/api";
import { SyncResultSchema } from "../../shared/protocol";
import type { ChatTarget } from "../models/chat";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TextStyle,
  ViewStyle,
  TextInputProps,
  TextProps,
  StyleProp,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { screenGutter } from "../theme/responsive";
import { theme as t } from "../theme";
import { resolveThumbnail } from "../services/images";
import type { Garment } from "../models";
import { garmentImages } from "../mocks/images";
import { useApp } from "../state/AppProvider";
const FocusScrollContext = createContext<() => void>(() => undefined);
export function Txt({
  children,
  style,
  serif = false,
  muted = false,
  numberOfLines,
  ...props
}: TextProps & {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  serif?: boolean;
  muted?: boolean;
  numberOfLines?: number;
}) {
  const textStyle = StyleSheet.flatten(style);
  const fontSize = textStyle?.fontSize ?? t.type.body;
  const lineHeight =
    textStyle?.lineHeight ?? Math.ceil(fontSize * (serif ? 1.14 : 1.45));
  return (
    <Text
      {...props}
      numberOfLines={numberOfLines}
      style={[
        s.text,
        serif && s.serif,
        { lineHeight },
        muted && { color: t.colors.muted },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 20,
  color = t.colors.ink,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: React.ComponentProps<typeof Feather>["color"];
}) {
  return (
    <Feather
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      name={name}
      size={size}
      color={color}
    />
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  style,
  testID,
  compact = false,
  accessibilityLabel,
  selected,
}: {
  accessibilityLabel?: string;
  selected?: boolean;
  compact?: boolean;
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: React.ComponentProps<typeof Feather>["name"];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const light = variant === "primary" || variant === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, selected }}
      aria-pressed={selected}
      accessibilityLabel={accessibilityLabel || title}
      testID={testID}
      hitSlop={compact ? 5 : undefined}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        compact && { minHeight: 34, paddingVertical: 7, paddingHorizontal: 12 },
        variant === "primary"
          ? { backgroundColor: t.colors.primary }
          : variant === "danger"
            ? { backgroundColor: t.colors.danger }
            : variant === "secondary"
              ? { backgroundColor: t.colors.sageLight }
              : { backgroundColor: "transparent" },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={light ? t.colors.onAccent : t.colors.sage} />
      ) : (
        <>
          {!!icon && (
            <Icon
              name={icon}
              size={17}
              color={light ? t.colors.onAccent : t.colors.sage}
            />
          )}
          <Txt
            style={{
              fontSize: compact ? 12 : 14,
              fontWeight: "600",
              color: light ? t.colors.onAccent : t.colors.sage,
              textAlign: "center",
              flexShrink: 1,
            }}
          >
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({
  name,
  onPress,
  label,
  color,
  disabled = false,
  selected,
}: {
  selected?: boolean;
  name: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled, selected }}
      aria-pressed={selected}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        selected && { backgroundColor: t.colors.sageLight },
        disabled && { opacity: 0.35 },
        pressed && { backgroundColor: t.colors.sageLight },
      ]}
    >
      <Icon
        name={name}
        color={color || (selected ? t.colors.sage : undefined)}
      />
    </Pressable>
  );
}
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={[s.card, style]}>{children}</View>
  );
}
export function Row({
  children,
  style,
  between = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  between?: boolean;
}) {
  return (
    <View
      style={[s.row, between && { justifyContent: "space-between" }, style]}
    >
      {children}
    </View>
  );
}
export function Badge({
  children,
  tone = "sage",
}: {
  children: React.ReactNode;
  tone?: "sage" | "neutral" | "warning" | "error";
}) {
  return (
    <View
      style={[
        s.badge,
        {
          backgroundColor:
            tone === "warning"
              ? t.colors.sand
              : tone === "error"
                ? t.colors.paleError
                : tone === "neutral"
                  ? t.colors.background
                  : t.colors.sageLight,
        },
      ]}
    >
      <Txt
        style={{
          fontSize: t.type.tiny,
          fontWeight: "600",
          color:
            tone === "error"
              ? t.colors.error
              : tone === "warning"
                ? t.colors.warning
                : t.colors.sage,
        }}
      >
        {children}
      </Txt>
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      aria-pressed={!!selected}
      onPress={onPress}
      style={[
        s.chip,
        selected && {
          backgroundColor: t.colors.primary,
          borderColor: t.colors.ink,
        },
      ]}
    >
      <Txt
        style={{
          fontSize: 13,
          color: selected ? t.colors.onAccent : t.colors.muted,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
export function Chips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0, flexShrink: 0 }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: t.spacing.sm, paddingVertical: 2 }}
    >
      {options.map((o) => (
        <Chip
          key={o}
          label={o}
          selected={o === value}
          onPress={() => onChange(o)}
        />
      ))}
    </ScrollView>
  );
}
export function Field({
  label,
  error,
  style,
  inputRef,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
}) {
  const revealFocusedField = useContext(FocusScrollContext);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Row between>
        <Txt style={{ fontSize: 13, fontWeight: "500" }}>{label}</Txt>
        {props.multiline && focused && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done editing"
            hitSlop={8}
            onPress={() => Keyboard.dismiss()}
            style={{
              minHeight: 28,
              paddingHorizontal: 8,
              justifyContent: "center",
            }}
          >
            <Txt
              style={{ fontSize: 13, color: t.colors.sage, fontWeight: "600" }}
            >
              Done
            </Txt>
          </Pressable>
        )}
      </Row>
      <TextInput
        ref={inputRef}
        keyboardAppearance="dark"
        accessibilityLabel={label}
        placeholderTextColor={t.colors.muted}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
          revealFocusedField();
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onContentSizeChange={(event) => {
          props.onContentSizeChange?.(event);
          revealFocusedField();
        }}
        style={[
          s.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          error && { borderColor: t.colors.error },
          style,
        ]}
      />
      {!!error && (
        <Txt
          style={{ fontSize: 12, color: t.colors.error }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Txt>
      )}
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Row between style={{ marginTop: t.spacing.sm }}>
      <Txt serif style={{ fontSize: t.type.title, flex: 1 }}>
        {title}
      </Txt>
      {!!action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ paddingVertical: 12, paddingLeft: 12 }}
        >
          <Txt
            style={{ color: t.colors.sage, fontSize: 13, fontWeight: "600" }}
          >
            {action} ↗
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}
type GarmentImageProps = {
  uri?: string | null;
  image?: Garment["image"];
  occasionId?: string;
  lookId?: string;
  chat?: ChatTarget & { messageId: string };
  style?: StyleProp<ViewStyle>;
  label?: string;
  onLoad?: () => void;
};
export function GarmentImage(props: GarmentImageProps) {
  const image = props.image;
  const key = [
    props.uri ?? image?.uri,
    image?.storagePath,
    image?.syncedAt,
    props.occasionId,
    props.lookId,
    JSON.stringify(props.chat),
  ].join("|");
  return <GarmentImageContent key={key} {...props} />;
}
function GarmentImageContent({
  uri: providedUri,
  image: assetImage,
  occasionId,
  lookId,
  chat,
  style,
  label,
  onLoad,
}: GarmentImageProps) {
  const originalUri = providedUri ?? assetImage?.uri;
  const [uri, setUri] = useState(originalUri);
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);
  useEffect(() => {
    let active = true;
    if (assetImage?.storagePath)
      resolveThumbnail(assetImage, occasionId, false, lookId, chat)
        .then((result) => {
          if (active) setUri(result);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
    };
  }, [originalUri, assetImage, occasionId, lookId, chat]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label || "Garment"}
      style={[
        {
          backgroundColor: t.colors.sand,
          overflow: "hidden",
          borderRadius: t.radius.md,
        },
        style,
      ]}
    >
      {uri && !failed ? (
        <Image
          accessibilityLabel={label || "Garment"}
          source={garmentImages[uri] || { uri }}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
          transition={120}
          cachePolicy="memory-disk"
          onLoad={onLoad}
          onError={() => {
            if (assetImage?.storagePath && !retried) {
              setRetried(true);
              resolveThumbnail(assetImage, occasionId, true, lookId, chat)
                .then(setUri)
                .catch(() => setFailed(true));
            } else setFailed(true);
          }}
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 80,
            gap: 8,
          }}
        >
          <Icon name="image" color={t.colors.muted} />
          <Txt muted style={{ fontSize: 11 }}>
            No photo
          </Txt>
        </View>
      )}
    </View>
  );
}
type AvatarProps = {
  name: string;
  size?: number;
  photo?: string | null;
  userId?: string;
};
export function Avatar(props: AvatarProps) {
  return (
    <AvatarContent
      key={`${props.userId || props.name}:${props.photo || "initials"}`}
      {...props}
    />
  );
}
function AvatarContent({ name, size = 44, photo, userId }: AvatarProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(
    photo && !photo.startsWith("avatar:") ? photo : null,
  );
  useEffect(() => {
    let active = true;
    if (photo?.startsWith("avatar:") && userId)
      void apiRequest("/v1/profile/photo/sign", SyncResultSchema, {
        uid: userId,
      })
        .then((r) => {
          if (active) setPhotoUri(r.signedUrl);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [photo, userId]);
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.colors.sageLight,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photoUri ? (
        <Image
          source={garmentImages[photoUri] || { uri: photoUri }}
          contentFit="cover"
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setPhotoUri(null)}
        />
      ) : (
        <Txt serif style={{ fontSize: size * 0.4, color: t.colors.sage }}>
          {name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")}
        </Txt>
      )}
    </View>
  );
}
export function Empty({
  title,
  body,
  action,
  onPress,
  icon = "inbox",
}: {
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <Card
      style={{
        alignItems: "center",
        paddingVertical: t.spacing.xxl,
        gap: t.spacing.md,
      }}
    >
      <Icon name={icon} size={28} color={t.colors.sage} />
      <Txt serif style={{ fontSize: 24, textAlign: "center" }}>
        {title}
      </Txt>
      <Txt muted style={{ textAlign: "center" }}>
        {body}
      </Txt>
      {!!action && onPress && (
        <Button title={action} onPress={onPress} variant="secondary" />
      )}
    </Card>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  action,
  scroll = true,
  maxWidth = 680,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
  scroll?: boolean;
  maxWidth?: number;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollOffset = useRef(0);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealFocusedField = useCallback(() => {
    if (Platform.OS !== "ios" || !scroll) return;
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      const keyboard = Keyboard.metrics();
      TextInput.State.currentlyFocusedInput()?.measureInWindow(
        (_x, y, _w, h) => {
          if (keyboard && y + h > keyboard.screenY - 60)
            scrollRef.current?.scrollTo({
              y: scrollOffset.current + y + h - keyboard.screenY + 60,
              animated: true,
            });
        },
      );
    }, 650);
  }, [scroll]);
  useEffect(() => {
    const subscription = Keyboard.addListener(
      "keyboardDidShow",
      revealFocusedField,
    );
    return () => {
      subscription.remove();
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, [revealFocusedField]);
  const { width } = useWindowDimensions();
  const { error, dismissError, busy, offline, user, refresh } = useApp();
  const refreshRetry = () => refresh().catch(() => undefined);
  const header = (
    <>
      {offline && (
        <Badge tone="warning">
          {user?.mode === "demo"
            ? "OFFLINE · DEMO CHANGES STAY ON THIS DEVICE"
            : "OFFLINE · CLOUD CHANGES NEED A CONNECTION"}
        </Badge>
      )}
      {(back || title) && (
        <View style={{ paddingTop: 4, gap: 4 }}>
          <Row between style={{ flexWrap: "nowrap", gap: 4 }}>
            {back && (
              <IconButton
                name="arrow-left"
                label="Go back"
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(tabs)/feed")
                }
              />
            )}
            {!!title && (
              <Txt serif style={{ fontSize: 25, flex: 1 }}>
                {title}
              </Txt>
            )}
            {action}
          </Row>
          {!!subtitle && (
            <Txt muted style={{ fontSize: 13 }}>
              {subtitle}
            </Txt>
          )}
        </View>
      )}
      {!!error && (
        <Card style={{ backgroundColor: t.colors.paleError }}>
          <Txt style={{ color: t.colors.error }}>{error}</Txt>
          <Row>
            <Button title="Dismiss" variant="ghost" onPress={dismissError} />
            {!!user && (
              <Button
                title="Retry refresh"
                variant="ghost"
                onPress={() => {
                  void refreshRetry();
                }}
              />
            )}
          </Row>
        </Card>
      )}
    </>
  );
  const fixedHeader = back && scroll;
  const content = (
    <View
      style={{
        width: "100%",
        maxWidth,
        ...(!scroll ? { flex: 1, minHeight: 0 } : {}),
        alignSelf: "center",
        paddingHorizontal: screenGutter(width, Platform.OS === "web"),
        gap: 12,
        paddingBottom: scroll ? 20 : 0,
      }}
    >
      {!fixedHeader && header}
      <FocusScrollContext.Provider value={revealFocusedField}>
        {children}
      </FocusScrollContext.Provider>
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: t.colors.background,
        paddingTop: insets.top + (Platform.OS === "web" ? 12 : 0),
      }}
      behavior={Platform.OS === "ios" && !scroll ? "padding" : undefined}
    >
      {busy && (
        <View
          style={{
            position: "absolute",
            top: insets.top,
            right: 12,
            zIndex: 9,
          }}
        >
          <ActivityIndicator size="small" color={t.colors.sage} />
        </View>
      )}
      {fixedHeader && (
        <View
          style={{
            width: "100%",
            maxWidth,
            alignSelf: "center",
            paddingHorizontal: screenGutter(width, Platform.OS === "web"),
            paddingBottom: 10,
            gap: 8,
          }}
        >
          {header}
        </View>
      )}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 12,
          }}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{content}</View>
      )}
    </KeyboardAvoidingView>
  );
}
export function Reveal({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduced ? undefined : FadeInDown.duration(t.duration.normal).springify()
      }
    >
      {children}
    </Animated.View>
  );
}
export function DemoNote({
  shopping = false,
  source,
}: {
  shopping?: boolean;
  source?: string;
}) {
  const { services } = useApp();
  const live = source === "sample" ? false : services.mode === "live";
  const isMeta = source === "meta";
  return (
    <Row style={{ gap: 6 }}>
      <Icon
        name={shopping ? "info" : "sliders"}
        size={13}
        color={t.colors.muted}
      />
      <Txt muted style={{ fontSize: 11, flex: 1 }}>
        {shopping
          ? live
            ? "Live listings via SerpApi · Prices verified on manual refresh"
            : "Sample listings & prices · No live search or monitoring"
          : isMeta
            ? "Meta AI · Grounded in your wardrobe · Always editable"
            : "Rule-based styling · Editable suggestions · No live AI"}
      </Txt>
    </Row>
  );
}
export function confirmAction(
  title: string,
  message: string,
  action: () => void,
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) action();
  } else
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: action },
    ]);
}
export const ignore = (p: Promise<unknown>) => {
  void p.catch(() => undefined);
};
export const s = StyleSheet.create({
  text: {
    fontSize: t.type.body,
    lineHeight: 22,
    color: t.colors.ink,
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
  },
  serif: {
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
    fontWeight: "600",
    lineHeight: undefined,
    letterSpacing: -0.7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  button: {
    minHeight: 44,
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: t.radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: t.radius.pill,
    alignSelf: "flex-start",
  },
  chip: {
    minHeight: 44,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 17,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    fontSize: 15,
    color: t.colors.ink,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rule: { height: 1, backgroundColor: t.colors.border },
});
