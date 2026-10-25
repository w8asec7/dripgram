import {
  AppData,
  Garment,
  Outfit,
  Occasion,
  EssentialsCategory,
  PriceWatch,
  ShoppingSearch,
  Profile,
  Availability,
  User,
  SocialGroup,
  CartItem,
} from "../models";
export type Command =
  | { type: "profile"; profile: Profile }
  | { type: "cart.add"; item: CartItem }
  | { type: "cart.remove"; id: string }
  | { type: "garment.bulk"; garments: Garment[] }
  | { type: "group.save"; group: SocialGroup }
  | { type: "group.leave"; id: string }
  | {
      type: "look.share";
      id: string;
      title: string;
      garmentIds: string[];
      outfitId: string | null;
      groupId: string | null;
      friendIds: string[];
      parentId?: string | null;
    }
  | { type: "look.react"; id: string }
  | { type: "look.comment"; id: string; text: string }
  | { type: "look.delete"; id: string }
  | { type: "garment.save"; garment: Garment }
  | { type: "garment.delete"; id: string }
  | { type: "garment.deleteMany"; ids: string[] }
  | { type: "wardrobe.washed" }
  | { type: "laundry"; ids: string[]; availability: Availability }
  | { type: "essential.save"; essential: EssentialsCategory }
  | { type: "essential.delete"; id: string }
  | {
      type: "outfit.feedback";
      outfit: Outfit;
      response: "wore" | "did-not-wear" | null;
    }
  | { type: "outfit.save"; outfit: Outfit }
  | { type: "outfit.delete"; id: string }
  | { type: "outfit.plan"; id: string; date: string }
  | {
      type: "wear";
      garmentIds: string[];
      laundryIds?: string[];
      keepAvailableIds?: string[];
      outfitId: string | null;
      date: string;
    }
  | { type: "checkin.skip"; date: string }
  | { type: "occasion.save"; occasion: Occasion }
  | { type: "occasion.delete"; id: string }
  | { type: "occasion.join"; id: string }
  | { type: "occasion.share"; id: string; outfitId: string }
  | { type: "occasion.vote"; id: string; submissionId: string }
  | { type: "occasion.comment"; id: string; submissionId: string; text: string }
  | { type: "occasion.theme"; id: string; theme: string }
  | { type: "friend.request"; toId: string }
  | { type: "friend.respond"; id: string; accept: boolean }
  | { type: "friend.remove"; friendId: string }
  | { type: "watch.save"; watch: PriceWatch }
  | { type: "watch.delete"; id: string }
  | { type: "search.save"; search: ShoppingSearch }
  | { type: "search.delete"; id: string }
  | { type: "notification.read"; id: string };
export interface DataRepository {
  load(userId: string): Promise<AppData>;
  execute(userId: string, command: Command): Promise<AppData>;
  reset?(userId: string): Promise<AppData>;
}
export interface AuthRepository {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string, name: string): Promise<User>;
  forgotPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  current(): Promise<User | null>;
}
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
