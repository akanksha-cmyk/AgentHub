/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  fitnessGoal: string;
  exerciseType: string;
  daysPerWeek: number | string;
  preferredTimes: string;
  location: string;
  experienceLevel: string;
}

export interface RecommendedStudio {
  name: string;
  address: string;
  reason: string;
  avatarUrl?: string;
  rating?: string;
  trialOffer?: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface Booking {
  date: string;
  time: string;
  studio: string;
  status: "confirmed" | "pending";
}

export interface StructuredOutput {
  agent: "Fitness";
  user_profile: UserProfile;
  recommended_studio: RecommendedStudio;
  email_drafted: EmailDraft;
  booking: Booking;
  dashboard_summary: string;
}

export interface Message {
  id: string;
  sender: "agent" | "user";
  text: string;
  timestamp: string;
}
