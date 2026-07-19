import { EventEmitter } from "events";

export const socketEmitter = new EventEmitter();

export interface SocketMessagePayload {
  conversationId: string;
  message: any;
  receiverId?: string;
}

export interface SocketNotificationPayload {
  userId: string;
  notification: any;
}

export interface SocketPostUpdatePayload {
  postId: string;
  data: any;
}
