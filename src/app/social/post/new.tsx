import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useApp, friendlyError } from "../../../state/AppProvider";
import {
  Screen,
  Txt,
  Card,
  Button,
  Row,
  Field,
  Chips,
  Badge,
  GarmentImage,
} from "../../../components/ui";
import { cameraService } from "../../../services/camera";
import {
  preparePostImage,
  cleanupTemporaryImage,
  removeDraftThumbnail,
} from "../../../services/images";
import { imagePayload, apiRequest } from "../../../services/api";
import { SyncResultSchema } from "../../../../shared/protocol";
import { postRepository } from "../../../repositories/posts";
import { postPiece } from "../../../features/feed/domain";
import { FashionPostSchema } from "../../../models/posts";
import { isoNow, makeId } from "../../../models";
export default function CreatePost() {
  const params = useLocalSearchParams<{ outfitId?: string }>();
  const { data, user, toast } = useApp();
  const created = useRef(isoNow());
  const id = useRef(makeId("post")),
    version = useRef(makeId("photo")),
    saved = useRef(false),
    lock = useRef(false),
    draft = useRef<string | null>(null);
  const [kind, setKind] = useState("Outfit");
  const [attach, setAttach] = useState(!!params.outfitId);
  const [photo, setPhoto] = useState<string | null>(null),
    [caption, setCaption] = useState(""),
    [visibility, setVisibility] = useState("Friends only"),
    [outfitId, setOutfitId] = useState(params.outfitId || ""),
    [picking, setPicking] = useState(false),
    [publishing, setPublishing] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (draft.current && !saved.current)
        void removeDraftThumbnail(draft.current).catch(() => undefined);
    },
    [],
  );
  if (!data || !user) return null;
  const outfit = data.outfits.find((o) => o.id === outfitId),
    pieces =
      outfit?.items
        .flatMap((i) => {
          const g = data.garments.find(
            (g) => g.id === i.garmentId && g.ownerId === user.id,
          );
          return g ? [postPiece(g, user.mode === "firebase")] : [];
        })
        .slice(0, 6) || [];
  const choose = async (source: "camera" | "library") => {
    if (picking || publishing) return;
    setPicking(true);
    setError("");
    try {
      const result = await (source === "camera"
        ? cameraService.capture()
        : cameraService.selectFromLibrary());
      if (!result) return;
      const uri = await preparePostImage(
        result.uri,
        result.width,
        result.height,
        user.id,
        id.current,
      );
      await cleanupTemporaryImage(result.uri);
      if (draft.current) await removeDraftThumbnail(draft.current);
      draft.current = uri;
      version.current = makeId("photo");
      setPhoto(uri);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPicking(false);
    }
  };
  const publish = async () => {
    if (lock.current || !photo) return;
    lock.current = true;
    setPublishing(true);
    setError("");
    try {
      let path: string | null = null;
      if (photo && user.mode === "firebase") {
        const uploaded = await apiRequest("/v1/posts/image", SyncResultSchema, {
          postId: id.current,
          version: version.current,
          image: await imagePayload(photo),
        });
        path = uploaded.path;
      }
      const stamp = created.current,
        post = FashionPostSchema.parse({
          id: id.current,
          ownerId: user.id,
          kind: kind === "Clothing" ? "clothing" : "outfit",
          caption,
          visibility: visibility === "Public" ? "public" : "friends",
          image: photo
            ? {
                uri: user.mode === "firebase" ? "" : photo,
                path,
                version: version.current,
              }
            : null,
          pieces: kind === "Clothing" ? [] : pieces,
          outfitId: kind === "Outfit" ? outfit?.id || null : null,
          createdAt: stamp,
          updatedAt: stamp,
          sample: false,
        });
      await postRepository(user, data).save(post);
      saved.current = true;
      if (user.mode === "firebase" && draft.current) {
        await removeDraftThumbnail(draft.current).catch(() => undefined);
        draft.current = null;
      }
      toast(
        user.mode === "demo"
          ? "Posted to your local demo feed."
          : "Your outfit is shared.",
      );
      router.replace(`/social/post/${post.id}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setPublishing(false);
    }
  };
  return (
    <Screen back title="Create post" subtitle="Your photo. Your perspective.">
      {user.mode === "demo" && (
        <Badge>LOCAL DEMO POST · NOT PUBLISHED TO REAL USERS</Badge>
      )}
      {photo ? (
        <GarmentImage
          uri={photo}
          label="Post photo preview"
          style={{ height: 330 }}
        />
      ) : (
        <Card>
          <Txt serif style={{ fontSize: 25 }}>
            Share something you love.
          </Txt>
          <Txt muted>A fit or a favorite piece. No closet setup required.</Txt>
        </Card>
      )}
      <Row>
        <Button
          title="Take photo"
          icon="camera"
          variant="secondary"
          disabled={picking || publishing}
          onPress={() => void choose("camera")}
        />
        <Button
          title="Choose photo"
          icon="image"
          variant="secondary"
          loading={picking}
          disabled={publishing}
          onPress={() => void choose("library")}
        />
      </Row>
      {!!photo && (
        <Button
          title="Remove photo"
          variant="ghost"
          onPress={() => setPhoto(null)}
        />
      )}
      <Chips options={["Outfit", "Clothing"]} value={kind} onChange={setKind} />
      {kind === "Outfit" && (
        <Button
          title={attach ? "Close saved outfits" : "Link saved outfit"}
          variant="ghost"
          disabled={picking || publishing}
          onPress={() => setAttach((value) => !value)}
        />
      )}
      {kind === "Outfit" && attach && (
        <View style={{ gap: 8 }}>
          {data.outfits.map((o) => (
            <Button
              key={o.id}
              title={`${o.id === outfitId ? "✓ " : ""}${o.name}`}
              variant={o.id === outfitId ? "secondary" : "ghost"}
              onPress={() => setOutfitId(o.id === outfitId ? "" : o.id)}
            />
          ))}
        </View>
      )}
      {kind === "Outfit" && !!outfit && (
        <Card>
          <Txt>{outfit.name}</Txt>
          <Txt muted>{pieces.map((p) => p.name).join(" + ")}</Txt>
          <Txt muted style={{ fontSize: 11 }}>
            Only these selected pieces are shared. Make sure they match the
            photo.
          </Txt>
        </Card>
      )}
      <Field
        label="Caption"
        testID="post-caption-input"
        value={caption}
        onChangeText={setCaption}
        maxLength={1000}
        multiline
        placeholder="The story behind your look…"
      />
      <Chips
        options={["Friends only", "Public"]}
        value={visibility}
        onChange={setVisibility}
      />
      <Txt muted style={{ fontSize: 12 }}>
        {visibility === "Public"
          ? "Any signed-in DripGram user can see and remix this post."
          : "Only you and your current friends can see this post."}
      </Txt>
      {!!error && (
        <Card>
          <Txt accessibilityRole="alert">{error}</Txt>
          <Txt muted>Your draft is still here. You can retry.</Txt>
        </Card>
      )}
      <Button
        title="Publish post"
        icon="send"
        loading={publishing}
        disabled={picking || !photo}
        onPress={() => void publish()}
      />
    </Screen>
  );
}
