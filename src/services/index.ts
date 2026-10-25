import { DemoLiveAIService, DemoLiveShoppingService } from "./demoLive";
import { AIService, MockAIService } from "./ai";
import { ShoppingService, MockShoppingService } from "./shopping";
import { BackendAIService, BackendShoppingService } from "./backend";
export interface AppServices {
  mode: "demo" | "live";
  ai: AIService;
  shopping: ShoppingService;
}
export const services: AppServices = {
  mode: "demo",
  ai: new MockAIService(),
  shopping: new MockShoppingService(),
};
export const liveServices: AppServices = {
  mode: "live",
  ai: new BackendAIService(),
  shopping: new BackendShoppingService(),
};

export const demoLiveServices: AppServices = {
  mode: "live",
  ai: new DemoLiveAIService(),
  shopping: new DemoLiveShoppingService(),
};
