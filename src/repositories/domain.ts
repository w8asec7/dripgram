import { calendarDate } from "../utils/dates";
import { z } from "zod";
import {
  migrateWearCounters,
  defaultWearLimit,
} from "../features/laundry/rules";
import {
  AppData,
  CartItemSchema,
  AppDataSchema,
  GarmentSchema,
  EssentialsCategorySchema,
  OutfitSchema,
  OutfitFeedbackSchema,
  OccasionSchema,
  PriceWatchSchema,
  ShoppingSearchSchema,
  ProfileSchema,
  SocialGroupSchema,
  SharedLookSchema,
  makeId,
  isoNow,
} from "../models";
import { Command } from "./contracts";
export const isFriend = (d: AppData, a: string, b: string) =>
  a !== b &&
  d.friendships.some((f) => f.members.includes(a) && f.members.includes(b));
export function canReadGarment(d: AppData, viewer: string, garmentId: string) {
  const g = d.garments.find((g) => g.id === garmentId);
  return (
    !!g &&
    (g.ownerId === viewer ||
      (g.visibility === "selected-friends" &&
        g.sharedWith.includes(viewer) &&
        isFriend(d, g.ownerId, viewer)))
  );
}
const replace = <T extends { id: string }>(list: T[], record: T) => [
  ...list.filter((x) => x.id !== record.id),
  record,
];
function owned(owner: string, userId: string) {
  if (owner !== userId)
    throw new Error("You do not have permission to change this record.");
}
export function applyCommand(
  original: AppData,
  userId: string,
  command: Command,
): AppData {
  owned(original.profile.id, userId);
  const snapshot = AppDataSchema.parse(JSON.parse(JSON.stringify(original)));
  const d = ["wear", "laundry", "wardrobe.washed"].includes(command.type)
    ? migrateWearCounters(snapshot)
    : snapshot;
  const now = isoNow();
  const garment = (id: string) => {
    const g = d.garments.find((g) => g.id === id);
    if (!g) throw new Error("This garment no longer exists.");
    owned(g.ownerId, userId);
    return g;
  };
  const occasion = (id: string) => {
    const o = d.occasions.find((o) => o.id === id);
    if (!o || !o.participantIds.includes(userId))
      throw new Error("This occasion is private or no longer available.");
    return o;
  };
  const look = (id: string) => {
    const record = d.looks.find((l) => l.id === id);
    if (!record || !canReadLook(d, userId, record.id))
      throw new Error("This outfit discussion is private or unavailable.");
    return record;
  };
  switch (command.type) {
    case "cart.add": {
      const item = CartItemSchema.parse(command.item);
      owned(item.ownerId, userId);
      if (item.id !== item.product.id)
        throw new Error("Cart item must reference its actual product.");
      d.cart = replace(d.cart, item);
      break;
    }
    case "cart.remove":
      d.cart = d.cart.filter((item) => item.id !== command.id);
      break;
    case "garment.bulk": {
      if (!command.garments.length || command.garments.length > 20)
        throw new Error("Review between1 and20 garments before saving.");
      const garments = command.garments.map((g) => GarmentSchema.parse(g));
      if (new Set(garments.map((g) => g.id)).size !== garments.length)
        throw new Error("Each garment needs a unique identifier.");
      for (const g of garments) {
        owned(g.ownerId, userId);
        const old = d.garments.find((x) => x.id === g.id);
        if (old && JSON.stringify(old) !== JSON.stringify(g))
          throw new Error(
            "A saved garment already uses this identifier. Refresh before retrying.",
          );
      }
      for (const g of garments) d.garments = replace(d.garments, g);
      break;
    }

    case "group.save": {
      const group = SocialGroupSchema.parse(command.group);
      owned(group.ownerId, userId);
      const previous = d.groups.find((g) => g.id === group.id);
      if (previous) owned(previous.ownerId, userId);
      if (
        !group.memberIds.includes(userId) ||
        new Set(group.memberIds).size !== group.memberIds.length ||
        group.memberIds.some((id) => id !== userId && !isFriend(d, userId, id))
      )
        throw new Error("Choose up to seven accepted friends for your group.");
      d.groups = replace(d.groups, group);
      break;
    }
    case "group.leave": {
      const group = d.groups.find((g) => g.id === command.id);
      if (!group || !group.memberIds.includes(userId))
        throw new Error("Group unavailable.");
      if (group.ownerId === userId) {
        d.groups = d.groups.filter((g) => g.id !== group.id);
      } else group.memberIds = group.memberIds.filter((id) => id !== userId);
      d.looks = d.looks.filter((l) => l.groupId !== group.id);
      break;
    }
    case "look.share": {
      if (d.looks.some((l) => l.id === command.id))
        throw new Error("This look was already shared.");
      const group = command.groupId
        ? d.groups.find(
            (g) => g.id === command.groupId && g.memberIds.includes(userId),
          )
        : null;
      if (command.groupId && !group)
        throw new Error("Choose a group you belong to.");
      if (command.friendIds.some((id) => !isFriend(d, userId, id)))
        throw new Error("Share only with accepted friends.");
      const parent = command.parentId ? look(command.parentId) : null;
      if (parent && parent.groupId !== command.groupId)
        throw new Error("Keep replies in the same audience.");
      const audience = parent?.audienceIds || [
        ...new Set([userId, ...(group ? group.memberIds : command.friendIds)]),
      ];
      if (audience.length < 2)
        throw new Error("Choose at least one friend or group.");
      if (
        command.outfitId &&
        !d.outfits.some(
          (o) => o.id === command.outfitId && o.ownerId === userId,
        )
      )
        throw new Error("Choose your own saved outfit.");
      const ids = [...new Set(command.garmentIds)];
      const pieces = ids.map((id) => {
        const g = garment(id);
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          primaryColor: g.primaryColor,
          image: g.image,
        };
      });
      d.looks.push(
        SharedLookSchema.parse({
          id: command.id,
          ownerId: userId,
          title: command.title,
          outfitId: command.outfitId,
          groupId: command.groupId,
          parentId: command.parentId || null,
          audienceIds: audience,
          pieces,
          reactions: [],
          comments: [],
          createdAt: now,
        }),
      );
      break;
    }
    case "look.react": {
      const l = look(command.id);
      l.reactions = l.reactions.includes(userId)
        ? l.reactions.filter((id) => id !== userId)
        : [...l.reactions, userId];
      break;
    }
    case "look.comment": {
      const l = look(command.id);
      const text = command.text.trim();
      if (!text || text.length > 180) throw new Error("Use 1–180 characters.");
      l.comments.push({
        id: makeId("comment"),
        authorId: userId,
        text,
        createdAt: now,
      });
      break;
    }
    case "look.delete": {
      const l = look(command.id);
      owned(l.ownerId, userId);
      d.looks = d.looks.filter((x) => x.id !== l.id);
      break;
    }

    case "profile": {
      owned(command.profile.id, userId);
      d.profile = ProfileSchema.parse(command.profile);
      d.directory = replace(
        d.directory,
        (({ id, displayName, username, photo, bio }) => ({
          id,
          displayName,
          username,
          photo,
          bio,
        }))(d.profile),
      );
      break;
    }
    case "garment.save": {
      const g = GarmentSchema.parse(command.garment);
      owned(g.ownerId, userId);
      if (g.sharedWith.some((f) => !isFriend(d, userId, f)))
        throw new Error("You can only share garments with accepted friends.");
      if (g.visibility === "private") g.sharedWith = [];
      d.garments = replace(d.garments, { ...g, updatedAt: now });
      break;
    }
    case "wardrobe.washed": {
      d.garments.forEach((g) => {
        owned(g.ownerId, userId);
        g.availability = "available";
        g.wearCount = 0;
        g.lastCleanedAt = now;
        g.manuallyOverridden = false;
        g.updatedAt = now;
      });
      d.essentials.forEach((e) => {
        owned(e.ownerId, userId);
        e.clean = e.total;
      });
      break;
    }
    case "garment.delete":
    case "garment.deleteMany": {
      const ids =
        command.type === "garment.delete"
          ? [command.id]
          : [...new Set(command.ids)];
      if (!ids.length)
        throw new Error("Select at least one garment to delete.");
      ids.forEach(garment);
      d.garments = d.garments.filter((g) => !ids.includes(g.id));
      d.outfits = d.outfits.map((o) => ({
        ...o,
        items: o.items.filter((i) => !ids.includes(i.garmentId)),
      }));
      break;
    }
    case "laundry": {
      command.ids.forEach((id) => {
        const g = garment(id);
        g.availability = command.availability;
        g.manuallyOverridden = true;
        if (command.availability === "available") {
          g.wearCount = 0;
          g.lastCleanedAt = now;
          g.manuallyOverridden = false;
        }
        g.updatedAt = now;
      });
      break;
    }
    case "essential.save": {
      const e = EssentialsCategorySchema.parse(command.essential);
      owned(e.ownerId, userId);
      d.essentials = replace(d.essentials, e);
      break;
    }
    case "essential.delete":
      d.essentials = d.essentials.filter((e) => e.id !== command.id);
      break;
    case "outfit.feedback": {
      const outfit = OutfitSchema.parse(command.outfit);
      owned(outfit.ownerId, userId);
      const ids = outfit.items.map((i) => i.garmentId);
      if (!ids.length || new Set(ids).size !== ids.length)
        throw new Error(
          "Choose a look with distinct owned pieces before leaving feedback.",
        );
      ids.forEach(garment);
      if (command.response === null) {
        d.outfitFeedback = d.outfitFeedback.filter((f) => f.id !== outfit.id);
        break;
      }
      const previous = d.outfitFeedback.find((f) => f.id === outfit.id);
      if (previous?.response === command.response) break;
      const feedback = OutfitFeedbackSchema.parse({
        id: outfit.id,
        ownerId: userId,
        outfitId: outfit.id,
        garmentIds: ids,
        occasionType: outfit.occasionType,
        response: command.response,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      });
      d.outfitFeedback = replace(d.outfitFeedback, feedback);
      break;
    }
    case "outfit.save": {
      const o = OutfitSchema.parse(command.outfit);
      owned(o.ownerId, userId);
      const ids = o.items.map((i) => i.garmentId);
      if (new Set(ids).size !== ids.length)
        throw new Error("Choose each garment only once.");
      ids.forEach(garment);
      d.outfits = replace(d.outfits, o);
      break;
    }
    case "outfit.delete":
      d.outfits = d.outfits.filter((o) => o.id !== command.id);
      break;
    case "outfit.plan": {
      if (!z.iso.date().safeParse(command.date).success)
        throw new Error("Choose a plan date in YYYY-MM-DD format.");
      const o = d.outfits.find((o) => o.id === command.id);
      if (!o) throw new Error("Save this outfit first.");
      o.items.forEach((i) => {
        if (["laundry", "unknown"].includes(garment(i.garmentId).availability))
          throw new Error(
            "One of these pieces is unavailable. Replace it before planning.",
          );
      });
      d.outfits.forEach((x) => {
        if (x.plannedFor === command.date) x.plannedFor = null;
      });
      o.plannedFor = command.date;
      o.confirmedAt = null;
      break;
    }
    case "wear": {
      if (
        !z.iso.date().safeParse(command.date).success ||
        command.date > calendarDate(new Date())
      )
        throw new Error("Choose today or a past date.");
      const ids = [...new Set(command.garmentIds)];
      if (!ids.length) throw new Error("Choose at least one garment.");
      ids.forEach(garment);
      if (command.outfitId) {
        const o = d.outfits.find((o) => o.id === command.outfitId);
        if (!o) throw new Error("Outfit not found.");
        if (d.wears.some((w) => w.outfitId === o.id && w.date === command.date))
          throw new Error("This outfit is already logged for that day.");
        o.confirmedAt = now;
      }
      const already = new Set(
        d.wears
          .filter((w) => w.date === command.date)
          .flatMap((w) => w.garmentIds),
      );
      const fresh = ids.filter((id) => !already.has(id));
      if (!fresh.length)
        throw new Error("These garments are already logged for that day.");
      d.wears.push({
        id: makeId("wear"),
        ownerId: userId,
        garmentIds: fresh,
        outfitId: command.outfitId,
        date: command.date,
        createdAt: now,
      });
      fresh.forEach((id) => {
        const g = garment(id);
        const beforeLastClean =
          !!g.lastCleanedAt &&
          command.date < calendarDate(new Date(g.lastCleanedAt));
        if (beforeLastClean) {
          g.lastWornAt = [g.lastWornAt || "", command.date].sort().at(-1)!;
          return;
        }
        g.wearCount = (g.wearCount ?? 0) + 1;
        g.lastWornAt = [g.lastWornAt || "", command.date].sort().at(-1)!;
        const limit =
          g.maxWearsBeforeLaundry === undefined
            ? defaultWearLimit[g.category]
            : g.maxWearsBeforeLaundry;
        const keep = command.keepAvailableIds?.includes(id);
        g.availability = command.laundryIds?.includes(id)
          ? "laundry"
          : keep
            ? "reusable"
            : g.availability === "laundry"
              ? "laundry"
              : limit === null
                ? "available"
                : g.wearCount >= limit
                  ? "laundry"
                  : "reusable";
        g.manuallyOverridden = !!keep || !!command.laundryIds?.includes(id);
        g.updatedAt = now;
      });
      break;
    }
    case "checkin.skip":
      d.skippedDates = Array.from(new Set([...d.skippedDates, command.date]));
      break;
    case "occasion.save": {
      const o = OccasionSchema.parse(command.occasion);
      owned(o.ownerId, userId);
      if (!o.participantIds.includes(userId))
        throw new Error("The host must be a participant.");
      o.participantIds
        .filter((p) => p !== userId)
        .forEach((p) => {
          if (!isFriend(d, userId, p))
            throw new Error("Invite an accepted friend.");
        });
      d.occasions = replace(d.occasions, o);
      break;
    }
    case "occasion.delete": {
      const o = occasion(command.id);
      owned(o.ownerId, userId);
      d.occasions = d.occasions.filter((o) => o.id !== command.id);
      break;
    }
    case "occasion.join": {
      const o = occasion(command.id);
      o.participants = o.participants.map((p) =>
        p.userId === userId ? { ...p, status: "accepted" } : p,
      );
      break;
    }
    case "occasion.share": {
      const o = occasion(command.id);
      const outfit = d.outfits.find((o) => o.id === command.outfitId);
      if (!outfit) throw new Error("Save an outfit before sharing.");
      if (!outfit.items.length) throw new Error("This outfit has no garments.");
      const pieces = outfit.items.map((i) => {
        const g = garment(i.garmentId);
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          primaryColor: g.primaryColor,
          image: g.image,
        };
      });
      const prior = o.submissions.find((s) => s.id === userId);
      o.submissions = replace(o.submissions, {
        id: userId,
        ownerId: userId,
        outfitName: outfit.name,
        pieces,
        votes: prior?.votes ?? [],
        comments: prior?.comments ?? [],
      });
      break;
    }
    case "occasion.vote": {
      const s = occasion(command.id).submissions.find(
        (s) => s.id === command.submissionId,
      );
      if (!s) throw new Error("This shared outfit no longer exists.");
      s.votes = s.votes.includes(userId)
        ? s.votes.filter((v) => v !== userId)
        : [...s.votes, userId];
      break;
    }
    case "occasion.comment": {
      const text = command.text.trim();
      if (!text || text.length > 180)
        throw new Error("Comments need 1–180 characters.");
      const s = occasion(command.id).submissions.find(
        (s) => s.id === command.submissionId,
      );
      if (!s) throw new Error("Shared outfit not found.");
      s.comments.push({
        id: makeId("comment"),
        authorId: userId,
        text,
        createdAt: now,
      });
      break;
    }
    case "occasion.theme": {
      const o = occasion(command.id);
      if (!command.theme.trim() || command.theme.length > 100)
        throw new Error("Use a theme of 1–100 characters.");
      o.theme = command.theme.trim();
      break;
    }
    case "friend.request": {
      if (
        command.toId === userId ||
        !d.directory.some((p) => p.id === command.toId)
      )
        throw new Error("Choose another user.");
      if (isFriend(d, userId, command.toId))
        throw new Error("You are already friends.");
      if (
        d.requests.some(
          (r) =>
            r.status === "pending" &&
            [r.fromId, r.toId].includes(userId) &&
            [r.fromId, r.toId].includes(command.toId),
        )
      )
        throw new Error("A request is already pending.");
      d.requests = replace(d.requests, {
        id: [userId, command.toId].sort().join("_"),
        fromId: userId,
        toId: command.toId,
        status: "pending",
        createdAt: now,
      });
      break;
    }
    case "friend.respond": {
      const r = d.requests.find((r) => r.id === command.id);
      if (!r || r.toId !== userId || r.status !== "pending")
        throw new Error("This request is no longer available.");
      r.status = command.accept ? "accepted" : "rejected";
      if (command.accept) {
        const members = [r.fromId, r.toId].sort();
        d.friendships = replace(d.friendships, {
          id: members.join("_"),
          members,
          createdAt: now,
        });
      }
      break;
    }
    case "friend.remove": {
      d.looks = d.looks
        .map((l) =>
          l.ownerId === userId && !l.groupId
            ? {
                ...l,
                audienceIds: l.audienceIds.filter(
                  (id) => id !== command.friendId,
                ),
              }
            : l,
        )
        .filter((l) => l.ownerId !== command.friendId || !!l.groupId);
      d.sharedGarments = d.sharedGarments.filter(
        (g) => g.ownerId !== command.friendId,
      );
      d.friendships = d.friendships.filter(
        (f) =>
          !(f.members.includes(userId) && f.members.includes(command.friendId)),
      );
      d.garments = d.garments.map((g) => ({
        ...g,
        sharedWith: g.sharedWith.filter((id) => id !== command.friendId),
      }));
      break;
    }
    case "watch.save": {
      const w = PriceWatchSchema.parse(command.watch);
      owned(w.ownerId, userId);
      d.watches = replace(
        d.watches.filter((x) => x.productId !== w.productId),
        w,
      );
      break;
    }
    case "watch.delete":
      d.watches = d.watches.filter((w) => w.id !== command.id);
      break;
    case "search.save": {
      const s = ShoppingSearchSchema.parse(command.search);
      owned(s.ownerId, userId);
      d.searches = replace(d.searches, s);
      break;
    }
    case "search.delete":
      d.searches = d.searches.filter((s) => s.id !== command.id);
      break;
    case "notification.read": {
      const n = d.notifications.find((n) => n.id === command.id);
      if (n) n.read = true;
      break;
    }
  }
  return AppDataSchema.parse(d);
}

export function canReadLook(d: AppData, viewer: string, id: string) {
  const l = d.looks.find((l) => l.id === id);
  return (
    !!l &&
    (l.ownerId === viewer ||
      (l.audienceIds.includes(viewer) &&
        (l.groupId
          ? d.groups.some(
              (g) => g.id === l.groupId && g.memberIds.includes(viewer),
            )
          : isFriend(d, l.ownerId, viewer))))
  );
}
