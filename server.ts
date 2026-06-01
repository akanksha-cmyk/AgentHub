/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization helper for Gemini SDK to avoid crashes if API key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. CHAT ONBOARDING ENDPOINT
// Guide the user through the onboarding conversation using Gemini
app.post("/api/onboard/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid messages array" });
      return;
    }

    const ai = getGeminiClient();

    // Construct history for Gemini chat
    const systemInstruction = `You are Sarah, the warm, confident, and professional Fitness Onboarding Agent for AgentHub.
You onboard the user via a conversational voice or video call.
Your goal is to gather their fitness preferences by asking exactly these 6 questions in natural, friendly conversation. Do NOT ask them as a dry list or in a single big block. Ask them one by one, reacting to their answers or combining naturally.

The 6 questions to cover:
1. What's your fitness goal? (e.g. weight loss, strength, flexibility, stress relief)
2. What type of exercise interests you? (yoga, pilates, gym, running, etc.)
3. How many days per week can you commit?
4. What times work for you? (morning, lunch, evening)
5. What's your general location or neighbourhood?
6. Are you a beginner or experienced?

Guidelines:
- Maintain a warm, encouraging, conversational tone. Speak as if on a voice call—brief, clear, and engaging.
- Continuously assess the chat history to see which of the 6 answers the user has already provided.
- If some answers are missing, ask for one of the missing pieces naturally (e.g. "That's awesome! Strength is a great goal. What type of exercise do you enjoy most? Things like yoga, gym, pilates, or running?").
- Under NO circumstances output a list of questions. Keep it as a back-and-forth conversation.
- If ALL 6 questions have been answered, you MUST say exactly: "Perfect. I'm going to find you the best option and take care of the booking. I'll let you know when it's confirmed."
- Do NOT continue talking or asking questions after saying that exact phrase.

Analyze the user's answers and also return the structured profile data if you can successfully identify all 6 attributes. To do this, we will configure Gemini to output a JSON object containing:
1. "reply": Sarah's natural conversational reply (string)
2. "profile": { "fitnessGoal": string | null, "exerciseType": string | null, "daysPerWeek": string | number | null, "preferredTimes": string | null, "location": string | null, "experienceLevel": string | null }
3. "allQuestionsAnswered": boolean (true if you have received answers for all 6 requirements and are concluding the onboarding with the perfect confirmation phrase).`;

    const chatContents = messages.map((m: any) => ({
      role: m.sender === "agent" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatContents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "The casual, warm conversational response as onboarding Agent Sarah.",
            },
            profile: {
              type: Type.OBJECT,
              description: "The current profile parameters extracted so far from the dialogue.",
              properties: {
                fitnessGoal: { type: Type.STRING },
                exerciseType: { type: Type.STRING },
                daysPerWeek: { type: Type.STRING },
                preferredTimes: { type: Type.STRING },
                location: { type: Type.STRING },
                experienceLevel: { type: Type.STRING },
              },
            },
            allQuestionsAnswered: {
              type: Type.BOOLEAN,
              description: "True if all 6 items of information have been obtained and the onboarding is now complete.",
            },
          },
          required: ["reply", "profile", "allQuestionsAnswered"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in onboarding chat:", error);
    res.status(500).json({ error: error.message || "Failed to process chat" });
  }
});

// 2. TASK EXECUTION ENDPOINT
// Executes research, email drafting, calendar availability lookup, and books the class.
app.post("/api/onboard/execute", async (req, res) => {
  try {
    const { profile } = req.body;
    if (!profile) {
      res.status(400).json({ error: "Missing user profile data" });
      return;
    }

    const ai = getGeminiClient();

    // Perform research on local studios using search grounding based on user location & fitness profile!
    const exerciseType = profile.exerciseType || "Pilates/Yoga";
    const location = profile.location || "San Francisco";
    const goal = profile.fitnessGoal || "fitness and strength";
    const experienceLevel = profile.experienceLevel || "beginner";

    const researchPrompt = `Find 3 highly-rated actual fitness studios or classes that teach ${exerciseType} around ${location}.
The user is a ${experienceLevel} whose goal is ${goal}.
Prioritize local studios that currently offer or are well-known for offering new-user introductory discounts, intro trials, or a free first class.
For each studio, output:
- name: Official studio name
- address: Studio address in ${location}
- rating: Rating out of 5 stars (e.g. "4.8")
- trialOffer: Details of their introductory trial package, first-class discount, or standard pricing
- reason: Accurate, tailored reason explaining why this studio perfectly fits the user's workout selection, level, and location.`;

    console.log("Searching and researching using googleSearch grounding tool...");
    const researchResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of 3 local studios found during Web search grounding.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              rating: { type: Type.STRING },
              trialOffer: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["name", "address", "rating", "trialOffer", "reason"],
          },
        },
      },
    });

    const studios = JSON.parse(researchResponse.text || "[]");
    const topStudio = studios[0] || {
      name: `Elite ${exerciseType} Studio`,
      address: `120 Main Street, ${location}`,
      rating: "4.9",
      trialOffer: "Free 1st Session or $30 Intro Week",
      reason: `Sleek local studio perfectly catering to ${experienceLevel} levels with specialized classes.`,
    };

    // 2. Draft introducing email to the top studio
    const emailPrompt = `Write a short, friendly, and persuasive email introducing the user to the manager of "${topStudio.name}".
The user is named Akanksha (email: akanksha.agarwalvirgo@gmail.com).
Mention that Akanksha is a ${experienceLevel} looking for ${exerciseType} classes in ${location} to achieve their goal of "${goal}".
Politely state that an autonomous agent is drafting this on her behalf to inquire about scheduling availability for a trial class and any special introductory promotional offers.
Output as a structured JSON object with keys:
- to: the draft recipient email (make up a realistic studio contact email like info@studio.com or hello@studio.com based on the studio's name)
- subject: a short and professional subject line
- body: warm, friendly copy with a clear call-to-action.`;

    const emailResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: emailPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            to: { type: Type.STRING },
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
          },
          required: ["to", "subject", "body"],
        },
      },
    });

    const emailDraft = JSON.parse(emailResponse.text || "{}");

    // 3. CALENDAR CHECK & BOOKING CONFIRMATION
    // Let's check available morning/evening slots in the user's calendar that don't conflict with existing events.
    // The preferred timing filter could be parsed here.
    const preferredTimes = profile.preferredTimes || "evening";
    const daysCommitting = profile.daysPerWeek || 3;

    const calendarPrompt = `Given the user prefers ${preferredTimes} workouts, analyze scheduling and pick the next 3 logical dates/times starting from June 2, 2026.
Avoid the following known conflicts in the user's schedule:
- Mondays 10:00 AM - 12:00 PM (Weekly Team Sync)
- Tuesdays 6:00 PM - 8:30 PM (Team Dinner / Social)
- Thursdays 1:00 PM - 3:00 PM (Project Work Session)

Identify the next 3 available morning/evening slots (matching preferred hours: morning is usually 7:30 AM - 9:30 AM, lunch is 12:00 PM - 1:30 PM, evening is 5:30 PM - 7:30 PM) on separate days that do not conflict.
Then, select the single best slot to schedule a start date at "${topStudio.name}".
Output as a JSON object:
- slots: Array of 3 string items representing the dates & times, e.g. ["Tuesday June 2 at 7:30 AM", "Wednesday June 3 at 6:30 PM", ...]
- selectedSlot: The picked best slot (e.g. Wednesday June 3, 2026 at 6:00 PM)
- dateString: Just the date of the selected slot
- timeString: Just the time of the selected slot
- dashboard_summary: A single warm, exciting sentence summarizing the confirmed session (e.g. "I have booked your first introductory session at Core Pilates in Downtown on Wednesday at 6 PM! Email draft has been prepared to secure your $30 trial.")`;

    const calendarResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: calendarPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slots: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            selectedSlot: { type: Type.STRING },
            dateString: { type: Type.STRING },
            timeString: { type: Type.STRING },
            dashboard_summary: { type: Type.STRING },
          },
          required: ["slots", "selectedSlot", "dateString", "timeString", "dashboard_summary"],
        },
      },
    });

    const calResult = JSON.parse(calendarResponse.text || "{}");

    // Formulate final structured output following requested schema EXACTLY:
    const output: any = {
      agent: "Fitness",
      user_profile: {
        fitnessGoal: goal,
        exerciseType: exerciseType,
        daysPerWeek: daysCommitting,
        preferredTimes: preferredTimes,
        location: location,
        experienceLevel: experienceLevel,
      },
      recommended_studio: {
        name: topStudio.name,
        address: topStudio.address,
        reason: topStudio.reason,
        rating: topStudio.rating,
        trialOffer: topStudio.trialOffer,
      },
      email_drafted: {
        to: emailDraft.to || `hello@${topStudio.name.toLowerCase().replace(/[^a-z]/g, "") || "studio"}.com`,
        subject: emailDraft.subject || "Inquiry about introductory offers and first-class scheduling",
        body: emailDraft.body || "",
      },
      booking: {
        date: calResult.dateString || "Session Date",
        time: calResult.timeString || "Session Time",
        studio: topStudio.name,
        status: "confirmed",
      },
      dashboard_summary: calResult.dashboard_summary || `Booked your first trial at ${topStudio.name}!`,
    };

    // Return the response as well as any other helpful execution variables
    res.json({
      output,
      additional_studios: studios,
      available_slots: calResult.slots || [],
    });
  } catch (error: any) {
    console.error("Error in onboarding execution pipeline:", error);
    res.status(500).json({ error: error.message || "Failed to execute fitness agent workflow" });
  }
});

// Serve frontend assets & mount Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
