import React from "react";
import { View } from "react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Field,
  Chips,
  Chip,
  Button,
  Card,
  Row,
  Badge,
  ignore,
} from "../components/ui";
import {
  Occasion,
  OccasionSchema,
  occasionTypes,
  makeId,
  isoNow,
  dateOffset,
} from "../models";
import { useApp } from "../state/AppProvider";
import { isFriend } from "../repositories/domain";
export function OccasionForm({ occasion }: { occasion?: Occasion }) {
  const { data, user, execute, busy } = useApp();
  const { control, handleSubmit, setValue } = useForm<Occasion>({
    resolver: zodResolver(OccasionSchema),
    defaultValues: occasion ?? {
      id: makeId("occasion"),
      ownerId: user?.id || "demo",
      name: "",
      date: dateOffset(1),
      time: "19:00",
      type: "Dinner",
      dressCode: "Smart casual",
      description: "",
      participantIds: [user?.id || "demo"],
      participants: [{ userId: user?.id || "demo", status: "accepted" }],
      submissions: [],
      theme: "",
      createdAt: isoNow(),
    },
  });
  const values = useWatch({ control, compute: (values) => values });
  if (!data || !user) return null;
  const submit = handleSubmit((o) =>
    execute({ type: "occasion.save", occasion: o }, "Good plans, made.").then(
      () => router.replace(`/occasion/${o.id}`),
    ),
  );
  return (
    <Screen
      back
      title={occasion ? "A change of plans." : "Make room for good company."}
      subtitle="An occasion to get together, and get dressed for."
    >
      {(["name", "date", "time", "dressCode", "description"] as const).map(
        (key) => (
          <Controller
            key={key}
            name={key}
            control={control}
            render={({ field, fieldState }) => (
              <Field
                label={
                  {
                    name: "Occasion name",
                    date: "Date (YYYY-MM-DD)",
                    time: "Time (24-hour HH:MM)",
                    dressCode: "Dress code",
                    description: "A note for your people (optional)",
                  }[key]
                }
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                multiline={key === "description"}
                placeholder={
                  key === "name" ? "e.g. Saturday dinner" : undefined
                }
              />
            )}
          />
        ),
      )}
      <Txt>Occasion type</Txt>
      <Chips
        options={occasionTypes}
        value={values.type}
        onChange={(v) => setValue("type", v as Occasion["type"])}
      />
      <Card>
        <Txt serif style={{ fontSize: 26 }}>
          Who’s coming?
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          Invite accepted friends. Only invited people can see this occasion.
        </Txt>
        <Row>
          {data.directory
            .filter((p) => isFriend(data, user.id, p.id))
            .map((p) => (
              <Chip
                key={p.id}
                label={p.displayName}
                selected={values.participantIds.includes(p.id)}
                onPress={() => {
                  const ids = values.participantIds.includes(p.id)
                    ? values.participantIds.filter((id) => id !== p.id)
                    : [...values.participantIds, p.id];
                  setValue("participantIds", ids);
                  setValue(
                    "participants",
                    ids.map(
                      (id) =>
                        values.participants.find((p) => p.userId === id) || {
                          userId: id,
                          status: "invited",
                        },
                    ),
                  );
                }}
              />
            ))}
        </Row>
        {!data.friendships.length && (
          <Button
            title="Find friends"
            variant="secondary"
            onPress={() => router.push("/settings/friends")}
          />
        )}
      </Card>
      <Field
        label="Group theme (optional)"
        value={values.theme}
        onChangeText={(v) => setValue("theme", v)}
        placeholder="e.g. Earth tones & easy layers"
      />
      <Badge>MANUAL OCCASION · CALENDAR NOT CONNECTED</Badge>
      <Button
        title={occasion ? "Save occasion" : "Create occasion"}
        icon="calendar"
        loading={busy}
        onPress={() => ignore(submit())}
      />
      <View style={{ height: 4 }} />
    </Screen>
  );
}
