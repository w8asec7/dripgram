import { ChatMessageSchema, ChatTarget, chatPath } from "../src/models/chat";
import { z } from "zod";
import { ApiError } from "./core";
import { Principal } from "./auth";
import {
  Garment,
  GarmentSchema,
  OccasionSchema,
  ProfileSchema,
  SubmissionSchema,
} from "../src/models";
export function decodeFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const decode = (x: unknown): unknown => {
    const v = x as Record<string, unknown>;
    if ("nullValue" in v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("mapValue" in v)
      return decodeFields(
        (v.mapValue as { fields?: Record<string, unknown> }).fields || {},
      );
    if ("arrayValue" in v)
      return ((v.arrayValue as { values?: unknown[] }).values || []).map(
        decode,
      );
    if ("timestampValue" in v) return v.timestampValue;
    return null;
  };
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, decode(v)]),
  );
}
export function encodeFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const encode = (v: unknown): unknown =>
    v === null
      ? { nullValue: null }
      : Array.isArray(v)
        ? { arrayValue: { values: v.map(encode) } }
        : typeof v === "object"
          ? { mapValue: { fields: encodeFields(v as Record<string, unknown>) } }
          : typeof v === "boolean"
            ? { booleanValue: v }
            : typeof v === "number"
              ? Number.isInteger(v)
                ? { integerValue: String(v) }
                : { doubleValue: v }
              : { stringValue: String(v) };
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, encode(v)]),
  );
}
export class UserDatabase {
  constructor(private project: string) {}
  async request(
    p: Principal,
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<unknown> {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${p.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
      },
    );
    if (r.status === 404) return null;
    if (!r.ok)
      throw new ApiError(
        r.status === 403 ? 403 : 503,
        "DATA_ACCESS",
        "This record is private, unavailable, or could not be loaded.",
      );
    return r.json();
  }
  async get(p: Principal, path: string) {
    const r = (await this.request(p, path)) as {
      fields?: Record<string, unknown>;
    } | null;
    return r?.fields ? decodeFields(r.fields) : null;
  }
  async list(p: Principal, path: string) {
    const r = (await this.request(p, path + "?pageSize=200")) as {
      documents?: { fields: Record<string, unknown> }[];
    } | null;
    return (r?.documents || []).map((d) => decodeFields(d.fields));
  }
  async garments(p: Principal): Promise<Garment[]> {
    return z
      .array(GarmentSchema)
      .parse(await this.list(p, `users/${p.uid}/garments`));
  }
  async profile(p: Principal) {
    return ProfileSchema.parse(await this.get(p, `users/${p.uid}`));
  }
  async authorizeImage(
    p: Principal,
    ownerId: string,
    garmentId: string,
    occasionId?: string,
    lookId?: string,
    chat?: ChatTarget & { messageId: string },
  ): Promise<void> {
    if (ownerId === p.uid) {
      if (
        !(await this.get(
          p,
          `users/${p.uid}/garments/${encodeURIComponent(garmentId)}`,
        ))
      )
        throw new ApiError(
          404,
          "GARMENT_MISSING",
          "Save the garment before syncing its thumbnail.",
        );
      return;
    }
    if (chat) {
      // This GET uses the caller’s Firebase token. Firestore enforces current
      // membership even if the caller guesses group, message and garment IDs.
      const message = ChatMessageSchema.safeParse(
        await this.get(
          p,
          `${chatPath(chat)}/${encodeURIComponent(chat.messageId)}`,
        ),
      );
      if (
        message.success &&
        message.data.authorId === ownerId &&
        message.data.attachment?.pieces.some((piece) => piece.id === garmentId)
      )
        return;
      throw new ApiError(
        403,
        "PRIVATE_IMAGE",
        "This garment was not shared in this conversation.",
      );
    }
    if (lookId) {
      const look = await this.get(
        p,
        `sharedLooks/${encodeURIComponent(lookId)}`,
      );
      if (
        look?.ownerId === ownerId &&
        ((look.pieces as { id: string }[]) || []).some(
          (piece) => piece.id === garmentId,
        )
      )
        return;
      throw new ApiError(
        403,
        "PRIVATE_IMAGE",
        "This garment was not shared in this look.",
      );
    }
    if (occasionId) {
      const o = await this.get(
        p,
        `occasions/${encodeURIComponent(occasionId)}`,
      );
      if (!o)
        throw new ApiError(403, "PRIVATE_IMAGE", "This image is private.");
      const sub = await this.get(
        p,
        `occasions/${encodeURIComponent(occasionId)}/submissions/${encodeURIComponent(ownerId)}`,
      );
      const pieces = (sub?.pieces ?? []) as { id: string }[];
      if (pieces.some((piece) => piece.id === garmentId)) return;
    }
    const shared = await this.get(
      p,
      `sharedGarments/${encodeURIComponent(garmentId)}`,
    );
    if (
      shared?.ownerId === ownerId &&
      (shared.friendIds as string[]).includes(p.uid)
    )
      return;
    throw new ApiError(
      403,
      "PRIVATE_IMAGE",
      "This image has not been shared with you.",
    );
  }
  async occasionContext(p: Principal, id: string) {
    const raw = await this.get(p, `occasions/${encodeURIComponent(id)}`);
    if (!raw)
      throw new ApiError(
        404,
        "OCCASION_MISSING",
        "This occasion is private or unavailable.",
      );
    const submissions = await this.list(
      p,
      `occasions/${encodeURIComponent(id)}/submissions`,
    );
    return {
      occasion: OccasionSchema.omit({ submissions: true }).parse(raw),
      submissions: z
        .array(SubmissionSchema.omit({ votes: true, comments: true }))
        .parse(submissions),
    };
  }
  async patchImage(p: Principal, id: string, image: unknown) {
    await this.request(
      p,
      `users/${p.uid}/garments/${encodeURIComponent(id)}?updateMask.fieldPaths=image`,
      "PATCH",
      { fields: encodeFields({ image }) },
    );
  }
  async saveProduct(p: Principal, id: string, product: unknown) {
    await this.request(
      p,
      `users/${p.uid}/products/${encodeURIComponent(id)}`,
      "PATCH",
      {
        fields: encodeFields({
          id,
          ownerId: p.uid,
          product,
          updatedAt: new Date().toISOString(),
        }),
      },
    );
  }
  async product(p: Principal, id: string) {
    const r = await this.get(
      p,
      `users/${p.uid}/products/${encodeURIComponent(id)}`,
    );
    return r?.product ?? null;
  }
}
