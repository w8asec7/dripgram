import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Screen, Txt, Field, Button, Card, ignore } from "../components/ui";
import { useApp } from "../state/AppProvider";
import { firebaseConfigured } from "../repositories/firebase";
const schema = z.object({
  name: z.string(),
  email: z.email("Enter a valid email address."),
  password: z.string(),
});
type Values = z.infer<typeof schema>;
export function AuthScreen({
  mode,
}: {
  mode: "sign-in" | "sign-up" | "forgot";
}) {
  const { authenticate, forgotPassword, enterDemo, busy, toast } = useApp();
  const { control, handleSubmit, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const submit = handleSubmit(async (v) => {
    if (mode === "sign-up" && v.name.trim().length < 2) {
      setError("name", { message: "Enter your name." });
      return;
    }
    if (mode !== "forgot" && v.password.length < 8) {
      setError("password", { message: "Use at least 8 characters." });
      return;
    }
    try {
      if (mode === "forgot") {
        await forgotPassword(v.email);
        toast("If an account exists, a reset link is on its way.");
        router.back();
      } else {
        const ready = await authenticate(
          mode,
          v.email,
          v.password,
          v.name.trim(),
        );
        router.replace(ready ? "/(tabs)/feed" : "/onboarding");
      }
    } catch {
      /* provider displays the recoverable error */
    }
  });
  return (
    <Screen
      back
      title={
        mode === "sign-up"
          ? "Make room for you."
          : mode === "forgot"
            ? "A fresh start."
            : "Welcome back."
      }
      subtitle={
        mode === "sign-up"
          ? "A more thoughtful wardrobe starts here."
          : mode === "forgot"
            ? "We’ll send a password reset link to your email."
            : "Your wardrobe is right where you left it."
      }
    >
      {!firebaseConfigured && (
        <Card>
          <Txt>Cloud accounts need Firebase configuration.</Txt>
          <Txt muted style={{ fontSize: 13 }}>
            Explore the full app with an offline demo account. No account or
            network needed.
          </Txt>
          <Button
            title="Explore demo"
            variant="secondary"
            onPress={() =>
              ignore(enterDemo().then(() => router.replace("/onboarding")))
            }
          />
        </Card>
      )}
      <View style={{ gap: 20, paddingVertical: 16 }}>
        {mode === "sign-up" && (
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Field
                label="Your name"
                placeholder="First and last name"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                textContentType="name"
                autoComplete="name"
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label="Email address"
              placeholder="you@example.com"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />
          )}
        />
        {mode !== "forgot" && (
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Field
                label="Password"
                placeholder="At least 8 characters"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                secureTextEntry
                textContentType={
                  mode === "sign-up" ? "newPassword" : "password"
                }
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
              />
            )}
          />
        )}
      </View>
      <Button
        title={
          mode === "sign-up"
            ? "Create account"
            : mode === "forgot"
              ? "Send reset link"
              : "Sign in"
        }
        loading={busy}
        onPress={() => ignore(submit())}
      />
      {mode === "sign-in" && (
        <Button
          title="Forgot your password?"
          variant="ghost"
          onPress={() => router.push("/auth/forgot")}
        />
      )}
      {mode !== "forgot" && (
        <Button
          title={
            mode === "sign-in"
              ? "New here? Create an account"
              : "Already have an account? Sign in"
          }
          variant="ghost"
          onPress={() =>
            router.replace(
              mode === "sign-in" ? "/auth/sign-up" : "/auth/sign-in",
            )
          }
        />
      )}
    </Screen>
  );
}
