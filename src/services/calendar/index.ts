import { Occasion } from "../../models";
export interface CalendarProvider {
  readonly connected: boolean;
  listEvents(from: string, to: string): Promise<Occasion[]>;
}
export class ManualCalendarProvider implements CalendarProvider {
  readonly connected = false;
  async listEvents() {
    return [];
  }
}
