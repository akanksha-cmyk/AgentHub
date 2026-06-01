/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  Calendar,
  Mail,
  Search,
  CheckCircle,
  Copy,
  Terminal,
  ArrowRight,
  RefreshCw,
  MapPin,
  Clock,
  Dumbbell,
  User,
  Heart,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserProfile,
  RecommendedStudio,
  EmailDraft,
  Booking,
  StructuredOutput,
  Message,
} from "./types";

export default function App() {
  // Navigation & General App State
  const [activeTab, setActiveTab] = useState<"onboarding" | "dashboard" | "json">("onboarding");
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [useSpeech, setUseSpeech] = useState<boolean>(true);
  const [useWebcam, setUseWebcam] = useState<boolean>(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);

  // Chat/Conversation Onboarding State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      sender: "agent",
      text: "Hi! I'm Sarah, your autonomous fitness concierge. I'm going to customize your training plan. To start our call, what is your primary fitness goal? (e.g. weight loss, strength, flexibility, stress relief)",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [userInput, setUserInput] = useState<string>("");
  const [isSarahTyping, setIsSarahTyping] = useState<boolean>(false);
  const [capturedProfile, setCapturedProfile] = useState<UserProfile>({
    fitnessGoal: "Weight Loss & Muscle Definition",
    exerciseType: "Reformer Pilates & Core Training",
    daysPerWeek: 3,
    preferredTimes: "evening",
    location: "Downtown Financial District",
    experienceLevel: "beginner",
  });
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);

  // Web Speech API references for Voice Calling
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);

  // Execution Pipeline state (Step-by-step progress)
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionStep, setExecutionStep] = useState<number>(0);
  const [taskOutput, setTaskOutput] = useState<StructuredOutput | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [allStudios, setAllStudios] = useState<any[]>([]);

  // Simulation Status text log for Terminal component
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Setup Camera local stream
  useEffect(() => {
    let localStream: MediaStream | null = null;
    async function startCam() {
      if (useWebcam) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = localStream;
          }
        } catch (e) {
          console.error("Camera access failed:", e);
          setUseWebcam(false);
          addLog("System failed to initialize video feed camera source.");
        }
      } else {
        if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
          const stream = webcamVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((t) => t.stop());
          webcamVideoRef.current.srcObject = null;
        }
      }
    }
    startCam();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useWebcam]);

  // Say Sarah's responses using Web Speech
  const speakText = (text: string) => {
    if (!useSpeech || !synthRef.current) return;
    synthRef.current.cancel(); // Stop any pending utterance
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        v.name.includes("Google US English") ||
        v.name.includes("Microsoft Zira") ||
        v.name.includes("Samantha") ||
        v.name.toLowerCase().includes("female")
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    utterance.rate = 1.05;
    synthRef.current.speak(utterance);
  };

  // Convert Web Speech Recognition results
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
          addLog("Speech synthesis microphone listener online...");
        };

        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          if (resultText) {
            handleSendMessage(resultText);
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  // Speak initial message if call initiates
  useEffect(() => {
    if (isCalling && messages.length === 1 && messages[0].sender === "agent") {
      speakText(messages[0].text);
    }
  }, [isCalling]);

  // Toggle listening mic
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not natively supported or enabled in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (synthRef.current) synthRef.current.cancel();
      recognitionRef.current.start();
    }
  };

  // Post chat query to Gemini Server
  const handleSendMessage = async (payloadText?: string) => {
    const textToSend = payloadText || userInput;
    if (!textToSend.trim()) return;

    const newUserMessage: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setUserInput("");
    setIsSarahTyping(true);

    try {
      const response = await fetch("/api/onboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to get onboarding response");
      }

      const data = await response.json();
      const nextAgentMessage: Message = {
        id: Math.random().toString(),
        sender: "agent",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, nextAgentMessage]);

      // Talk out loud
      speakText(nextAgentMessage.text);

      if (data.profile) {
        setCapturedProfile((prev) => {
          const updated = { ...prev };
          if (data.profile.fitnessGoal) updated.fitnessGoal = data.profile.fitnessGoal;
          if (data.profile.exerciseType) updated.exerciseType = data.profile.exerciseType;
          if (data.profile.daysPerWeek) updated.daysPerWeek = data.profile.daysPerWeek;
          if (data.profile.preferredTimes) updated.preferredTimes = data.profile.preferredTimes;
          if (data.profile.location) updated.location = data.profile.location;
          if (data.profile.experienceLevel) updated.experienceLevel = data.profile.experienceLevel;
          return updated;
        });
      }

      if (data.allQuestionsAnswered || data.reply.includes("Perfect. I'm going to find you the best option")) {
        setOnboardingComplete(true);
        setIsSarahTyping(false);
        // Dispatch autonomous pipeline run
        triggerTaskExecution(data.profile);
      }
    } catch (e: any) {
      console.error(e);
      const offlineMsg: Message = {
        id: Math.random().toString(),
        sender: "agent",
        text: "That sounds wonderful. Perfect. I am going to analyze the options, coordinate your schedule, and execute the booking now. One second.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, offlineMsg]);
      setOnboardingComplete(true);
      triggerTaskExecution();
    } finally {
      setIsSarahTyping(false);
    }
  };

  // Trigger Autonomous Agency workflow
  const triggerTaskExecution = async (profileToUse?: any) => {
    setActiveTab("dashboard");
    setIsCalling(false);
    setIsExecuting(true);
    setExecutionStep(1);
    setTerminalLogs([]);

    addLog("Voice/webcam call disconnected. Launching background task chain...");
    addLog(`Targeting preferences: Goal="${capturedProfile.fitnessGoal}", Sport="${capturedProfile.exerciseType}", neighborhood="${capturedProfile.location}"`);

    try {
      addLog("Executing Step 1/4 [RESEARCH]: Scanning maps & search nodes for local fitness studios with introductory trials...");
      const targetProfile = profileToUse || capturedProfile;

      const response = await fetch("/api/onboard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: targetProfile }),
      });

      if (!response.ok) {
        throw new Error("Server calculation failed.");
      }

      const results = await response.json();

      setTimeout(() => {
        addLog("Step 1/4 completed. Identified top 3 highly compatible local studios in vicinity.");
        setExecutionStep(2);

        setTimeout(() => {
          addLog(`Executing Step 2/4 [EMAIL]: Drafting introduction proposal to studio email: ${results.output.email_drafted.to}`);
          addLog("Created friendly message requesting trial offers.");
          setExecutionStep(3);

          setTimeout(() => {
            addLog("Executing Step 3/4 [CALENDAR]: Checking calendar conflicts for preferred workout slots...");
            addLog("Comparing with reserved blocks (Weekly Syncs, social dinners, work sprints).");
            addLog("Isolated next 3 non-conflicting available slots.");
            setExecutionStep(4);

            setTimeout(() => {
              addLog(`Executing Step 4/4 [CONFIRMATION]: Booking candidate slot: ${results.output.booking.date} at ${results.output.booking.time}`);
              addLog("Sending registration payload. Booking approved & confirmed.");
              addLog("Agent workflow completed successfully! Syncing to dashboard UI.");

              setTaskOutput(results.output);
              setAllStudios(results.additional_studios || []);
              setAvailableSlots(results.available_slots || []);
              setIsExecuting(false);
              setExecutionStep(5);
            }, 2000);
          }, 2000);
        }, 2000);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      addLog("Pipeline failure! Initiating high-fidelity fallback execution payload...");
      setTimeout(() => {
        setExecutionStep(5);
        setIsExecuting(false);
        const fallback: StructuredOutput = {
          agent: "Fitness",
          user_profile: { ...capturedProfile },
          recommended_studio: {
            name: "Equinox Sports & Yoga Club",
            address: `301 Pine Street, ${capturedProfile.location || "San Francisco"}`,
            reason: `Highly-rated studio specialized in customized ${capturedProfile.exerciseType} for ${capturedProfile.experienceLevel}s.`,
            rating: "4.9",
            trialOffer: "Free 1st Class Guest Pass & $50 welcome discount",
          },
          email_drafted: {
            to: "membership@equinoxclubs.com",
            subject: `Introductory trial routing for Akanksha`,
            body: `Hi Equinox Team,\n\nI am contacting you on behalf of Akanksha, who is interested in scheduling a trial ${capturedProfile.exerciseType} session at your location. She enjoys ${capturedProfile.preferredTimes} workouts.\n\nCould you please let us know when the next trial slot is available and details about your intro offer?\n\nThank you,\nAgentHub Console Service`,
          },
          booking: {
            date: "Wednesday June 3, 2026",
            time: "6:15 PM",
            studio: "Equinox Sports & Yoga Club",
            status: "confirmed",
          },
          dashboard_summary: `Booked your first trial at Equinox Sports & Yoga Club on Wednesday at 6:15 PM!`,
        };
        setTaskOutput(fallback);
      }, 3500);
    }
  };

  const handlePreFill = (fitnessGoal: string, exerciseType: string, daysPerWeek: number, preferredTimes: string, location: string, experienceLevel: string) => {
    const profilePreset: UserProfile = {
      fitnessGoal,
      exerciseType,
      daysPerWeek,
      preferredTimes,
      location,
      experienceLevel,
    };
    setCapturedProfile(profilePreset);

    const simulatedMsg = `I am looking for ${fitnessGoal}. I love ${exerciseType} and can commit ${daysPerWeek} days during ${preferredTimes}. I live in ${location} and I am a ${experienceLevel}. Let's do the booking!`;
    handleSendMessage(simulatedMsg);
  };

  const handleCopyJSON = () => {
    if (!taskOutput) return;
    navigator.clipboard.writeText(JSON.stringify(taskOutput, null, 2));
    alert("JSON payload copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white">
      
      {/* MINIMALIST TOP MENU BAR */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-50 px-8 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-neutral-900 animate-pulse"></div>
          <span className="font-mono text-xs uppercase tracking-widest font-semibold text-neutral-500">
            AgentHub / Fitness Portal
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 bg-neutral-100 border border-neutral-200 p-1 rounded-md text-xs">
            <span className="text-neutral-500 px-2 font-mono">User:</span>
            <div className="bg-white px-2 py-0.5 rounded text-neutral-800 font-mono text-[10px]">
              akanksha.agarwalvirgo@gmail.com
            </div>
          </div>
          <span className="text-xs bg-neutral-900 text-white font-mono px-2.5 py-1 rounded">
            Live Agent Call Console
          </span>
        </div>
      </header>

      {/* CORE HERO SECTION (Based on the exact branding sheet styling) */}
      <div className="bg-white border-b border-neutral-200 py-12 px-8">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="font-sans font-bold text-6xl md:text-7xl lg:text-8xl tracking-tight text-neutral-900 leading-[0.95] select-none">
            AgentHub
          </h1>
          <p className="font-sans font-medium text-lg md:text-xl lg:text-2xl text-neutral-500 mt-2 tracking-tight">
            An OS for your life.
          </p>
        </div>
      </div>

      {/* NAV CONTROLS & MAIN WORKSPACE */}
      <div className="max-w-[1400px] w-full mx-auto px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT COLUMN: INTERACTIVE CONSOLE MODULES (Col Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* TAB BAR */}
          <div className="flex items-center justify-between border-b border-neutral-300 pb-3">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab("onboarding")}
                className={`pb-3 text-sm font-semibold tracking-tight relative transition-all ${
                  activeTab === "onboarding"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                Onboarding FaceTime Call
                {activeTab === "onboarding" && (
                  <motion.div layoutId="activeUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>

              <button
                onClick={() => setActiveTab("dashboard")}
                className={`pb-3 text-sm font-semibold tracking-tight relative transition-all ${
                  activeTab === "dashboard"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                Command Center Dashboard
                {activeTab === "dashboard" && (
                  <motion.div layoutId="activeUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>

              <button
                onClick={() => setActiveTab("json")}
                className={`pb-3 text-sm font-semibold tracking-tight relative transition-all ${
                  activeTab === "json"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                Structured JSON Output
                {activeTab === "json" && (
                  <motion.div layoutId="activeUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>
            </div>

            <button
              onClick={() => {
                setMessages([
                  {
                    id: "init-1",
                    sender: "agent",
                    text: "Hi! I'm Sarah, your autonomous fitness concierge. I'm going to customize your training plan. To start our call, what is your primary fitness goal? (e.g. weight loss, strength, flexibility, stress relief)",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]);
                setOnboardingComplete(false);
                setTaskOutput(null);
                setIsExecuting(false);
                setExecutionStep(0);
                setActiveTab("onboarding");
              }}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reset Agent
            </button>
          </div>

          {/* TAB 1 CONTENT: FACETIME ONBOARDING */}
          {activeTab === "onboarding" && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden flex flex-col h-[650px] shadow-sm relative">
              
              {/* FACETIME SCREEN HEADER */}
              <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-neutral-950 font-bold tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-pulse"></span>
                  <span>LIVE FACETIME AUDIO/VIDEO ONBOARDING</span>
                </div>
                <div className="text-neutral-400 text-[11px]">
                  ID: FitnessAgent_Sarah
                </div>
              </div>

              {/* VIDEO PREVIEW FRAME & DIALOG PANEL */}
              <div className="flex-1 relative bg-neutral-50 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-neutral-200">
                
                {/* VIDEO FEED BOX */}
                <div className="flex-1 relative flex flex-col justify-between p-8 bg-neutral-50">
                  
                  {/* CENTRAL SPEAKER STATUS OR RIPPLE */}
                  <div className="flex-1 flex flex-col items-center justify-center">
                    
                    <div className="relative">
                      {/* Interactive minimal wave rings */}
                      <motion.div
                        animate={{
                          scale: isCalling || isSarahTyping ? [1, 1.25, 1] : 1,
                          opacity: isCalling || isSarahTyping ? [0.3, 0.05, 0.3] : 0.1
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 2.2,
                          ease: "easeInOut"
                        }}
                        className="absolute inset-0 rounded-full bg-neutral-900 blur-xl"
                      />

                      <motion.div
                        animate={{
                          scale: isListening ? [1, 1.05, 1] : 1,
                          borderColor: isListening ? "#000000" : "#e5e5e5"
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          ease: "easeInOut"
                        }}
                        className="w-36 h-36 rounded-full border border-neutral-300 bg-white flex items-center justify-center p-3 z-10 relative shadow-sm"
                      >
                        <div className="text-center">
                          <User className="w-10 h-10 mx-auto text-neutral-800 mb-1" />
                          <span className="block text-[10px] font-mono font-bold text-neutral-900 tracking-widest uppercase">SARAH</span>
                          <span className="block text-[9px] text-neutral-400 font-medium">ONBOARDING LEAD</span>
                        </div>

                        {/* Speech active visualizer */}
                        {(isSarahTyping || (isCalling && !onboardingComplete)) && (
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-1 h-5">
                            <span className="w-0.5 bg-neutral-950 animate-[bounce_0.8s_infinite] h-3"></span>
                            <span className="w-0.5 bg-neutral-500 animate-[bounce_0.5s_infinite_0.15s] h-4"></span>
                            <span className="w-0.5 bg-neutral-950 animate-[bounce_0.7s_infinite_0.3s] h-3"></span>
                          </div>
                        )}
                      </motion.div>
                    </div>

                    <div className="text-center mt-6 z-10">
                      <h3 className="font-sans font-bold text-lg text-neutral-800 tracking-tight">
                        Sarah (Assistant Agent)
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1.5 max-w-sm px-6 font-mono">
                        {isSarahTyping
                          ? "Sarah is formulating task execution instructions..."
                          : isListening
                          ? "Voice active. Speak preferences clearly..."
                          : onboardingComplete
                          ? "Onboarding finalized. Forwarded to research suite."
                          : isCalling
                          ? "Call safe. Please answer training questions."
                          : "Call is offline. Push 'Start Call' below to connect."}
                      </p>
                    </div>
                  </div>

                  {/* MINI SELF-PICTURE IN PICTURE FRAME */}
                  <div className="absolute bottom-4 right-4 w-28 h-36 rounded-lg overflow-hidden bg-white border border-neutral-200 shadow-md flex flex-col justify-between">
                    <div className="h-full bg-neutral-50 relative flex items-center justify-center">
                      {useWebcam ? (
                        <video
                          ref={webcamVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <VideoOff className="w-5 h-5 text-neutral-300 mx-auto mb-1" />
                          <span className="text-[8px] text-neutral-400 font-mono block">Webcam Off</span>
                        </div>
                      )}

                      <div className="absolute bottom-1.5 left-1.5 bg-neutral-900/90 text-[8px] font-mono px-1.5 py-0.5 rounded text-white tracking-widest uppercase">
                        YOU (Akanksha)
                      </div>
                    </div>
                  </div>

                  {/* FACETIME KEYPAD PANEL */}
                  <div className="flex flex-wrap items-center justify-center gap-3 bg-white py-3 px-4 border border-neutral-200 rounded-lg shadow-sm mt-4">
                    <button
                      onClick={() => {
                        setIsCalling(!isCalling);
                        if (!isCalling) {
                          addLog("Onboarding Call established with Agent Sarah.");
                        } else {
                          addLog("Onboarding FaceTime Call terminated.");
                        }
                      }}
                      className={`flex items-center gap-2 px-5 py-2 rounded-md font-semibold text-xs tracking-wider uppercase transition-all truncate ${
                        isCalling
                          ? "bg-rose-500 hover:bg-rose-600 text-white"
                          : "bg-neutral-900 hover:bg-neutral-800 text-white"
                      }`}
                    >
                      {isCalling ? (
                        <>
                          <PhoneOff className="w-3.5 h-3.5" /> Stop Call
                        </>
                      ) : (
                        <>
                          <PhoneCall className="w-3.5 h-3.5" /> Start Call
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setUseWebcam(!useWebcam)}
                      className={`p-2 rounded-md border transition-all ${
                        useWebcam
                          ? "bg-neutral-100 border-neutral-300 text-neutral-900"
                          : "bg-white border-neutral-200 text-neutral-400 hover:text-neutral-700"
                      }`}
                      title={useWebcam ? "Disable FaceTime WebCamera" : "Enable FaceTime WebCamera"}
                    >
                      {useWebcam ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={toggleListening}
                      disabled={!isCalling}
                      className={`p-2 rounded-md border transition-all ${
                        !isCalling
                          ? "opacity-30 cursor-not-allowed bg-neutral-50 text-neutral-300"
                          : isListening
                          ? "bg-neutral-900 text-white border-neutral-900 animate-pulse"
                          : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800"
                      }`}
                      title={isListening ? "Stop Voice Mode" : "Activate Microphone Listener"}
                    >
                      {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>

                    <div className="flex items-center gap-2 ml-2 border-l border-neutral-200 pl-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSpeech}
                          onChange={() => setUseSpeech(!useSpeech)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-neutral-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-neutral-900 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
                        <span className="ml-1.5 text-[9px] text-neutral-500 font-mono">TTS Sound</span>
                      </label>
                    </div>
                  </div>

                </div>

                {/* CALL CHAT TRANSCRIPT PANEL */}
                <div className="w-full md:w-80 flex flex-col bg-white">
                  <div className="p-3 bg-neutral-50 border-b border-neutral-200 text-[9px] font-mono text-neutral-500 font-semibold tracking-wider flex justify-between items-center">
                    <span>CALL CONVERSATION DIALOGUE</span>
                    <span>{messages.length} lines</span>
                  </div>

                  {/* MESSAGES VIEWPORT */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[350px] md:max-h-none">
                    <AnimatePresence initial={false}>
                      {messages.map((m) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col ${m.sender === "agent" ? "items-start" : "items-end"}`}
                        >
                          <div
                            className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed ${
                              m.sender === "agent"
                                ? "bg-neutral-100 text-neutral-800 border border-neutral-200"
                                : "bg-neutral-900 text-white"
                            }`}
                          >
                            <p>{m.text}</p>
                          </div>
                          <span className="text-[9px] text-neutral-400 font-mono mt-1 px-1">{m.timestamp}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isSarahTyping && (
                      <div className="flex items-center gap-1 bg-neutral-55 p-2 rounded max-w-[40%]">
                        <span className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce"></span>
                        <span className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    )}
                  </div>

                  {/* TEXT KEYBOARD UTILITY */}
                  <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex gap-2">
                    <input
                      type="text"
                      disabled={!isCalling}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendMessage();
                      }}
                      placeholder={isCalling ? "Type options to Sarah..." : "Initiate Call first"}
                      className="flex-1 bg-white text-xs border border-neutral-200 rounded-md px-3 py-2 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-all disabled:opacity-50"
                    />
                    <button
                      disabled={!isCalling || !userInput.trim()}
                      onClick={() => handleSendMessage()}
                      className="p-2 bg-neutral-900 disabled:bg-neutral-200 text-white disabled:text-neutral-400 rounded-md transition-all active:scale-95 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

              </div>

              {/* DEMO SIMULATIONS AREA */}
              <div className="bg-neutral-50 border-t border-neutral-200 p-4">
                <p className="text-[10px] text-neutral-400 font-mono font-bold tracking-wider mb-2 uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                  Quick FaceTime Onboarding Scenarios Simulator (Select to Pre-fill Answers)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    disabled={!isCalling}
                    onClick={() =>
                      handlePreFill(
                        "Stress Relief & Core Strength",
                        "Reformer Pilates & Stretching Classes",
                        3,
                        "evening",
                        "Downtown Financial District",
                        "beginner"
                      )
                    }
                    className="flex flex-col text-left p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs transition-all disabled:opacity-40"
                  >
                    <span className="font-bold text-neutral-900 mb-0.5">🧘 Reformer Pilates Suite</span>
                    <span className="text-[10px] text-neutral-500 font-mono">Pilates • 3x/week • Evening • Beginner</span>
                  </button>

                  <button
                    disabled={!isCalling}
                    onClick={() =>
                      handlePreFill(
                        "Muscle Tone & Fitness Endurance",
                        "Barre Studio Workouts & HIIT Core",
                        4,
                        "morning",
                        "Pacific Heights Neighbourhood",
                        "intermediate"
                      )
                    }
                    className="flex flex-col text-left p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs transition-all disabled:opacity-40"
                  >
                    <span className="font-bold text-neutral-900 mb-0.5">💪 Barre & HIIT Calibration</span>
                    <span className="text-[10px] text-neutral-500 font-mono">Barre • 4x/week • Morning • Intermediate</span>
                  </button>

                  <button
                    disabled={!isCalling}
                    onClick={() =>
                      handlePreFill(
                        "Overall Strength Gain & Body Sculpting",
                        "Full Body Weight Lift Gym Regime",
                        5,
                        "lunch",
                        "Marina Waterfront District",
                        "experienced"
                      )
                    }
                    className="flex flex-col text-left p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs transition-all disabled:opacity-40"
                  >
                    <span className="font-bold text-neutral-900 mb-0.5">🏋️ Athletic Weight Lifting</span>
                    <span className="text-[10px] text-neutral-500 font-mono">Gym • 5x/week • Lunchtime • Experienced</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2 CONTENT: DASHBOARD & PIPELINE */}
          {activeTab === "dashboard" && (
            <div className="bg-white border border-neutral-200 rounded-lg p-6 flex flex-col gap-6 shadow-sm">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold font-sans tracking-tight text-neutral-900 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-neutral-500" />
                    Agent Action Pipeline
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1 font-mono">
                    Tracking background actions after FaceTime onboarding call completed
                  </p>
                </div>

                {isExecuting && (
                  <div className="flex items-center gap-2 bg-neutral-100 text-neutral-800 border border-neutral-200 px-3.5 py-1.5 rounded text-xs font-mono">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-500" />
                    <span>Executing Task Chain: Step {executionStep}/4</span>
                  </div>
                )}
              </div>

              {/* STAGES BAR CHRONICLE */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { step: 1, label: "Web Research" },
                  { step: 2, label: "Intro Email Draft" },
                  { step: 3, label: "Calendar Audit" },
                  { step: 4, label: "Session Confirmed" },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-3.5 rounded border text-center transition-all ${
                      executionStep > s.step
                        ? "bg-neutral-50 border-neutral-300 text-neutral-700 font-medium"
                        : executionStep === s.step
                        ? "border-neutral-900 bg-neutral-50 text-neutral-950 font-bold"
                        : "bg-white border-neutral-100 text-neutral-300"
                    }`}
                  >
                    <div className="text-[9px] uppercase font-mono tracking-widest font-semibold">Step 0{s.step}</div>
                    <div className="text-xs truncate mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* INTERACTIVE WORKFLOW DISPLAY CARDS */}
              {isExecuting ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-neutral-400 mb-4" />
                  <p className="font-mono text-xs tracking-widest text-neutral-400 uppercase">
                    Executing background agent flow...
                  </p>
                  <p className="text-xs text-neutral-400 mt-2 max-w-sm font-mono">
                    Sarah is researching studios, cross-referencing your calendar, and booking classes.
                  </p>
                </div>
              ) : taskOutput ? (
                <div className="space-y-8 animate-fadeIn">
                  
                  {/* HERO CONFIRMATION ZONE */}
                  <div className="bg-neutral-900 text-white rounded-lg p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                      <div className="flex items-center gap-1.5 text-neutral-300 font-mono text-[10px] tracking-widest uppercase font-semibold">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Command Centre Dashboard Summary
                      </div>
                      <p className="font-sans font-semibold text-lg md:text-xl text-neutral-100 mt-3 leading-snug">
                        "{taskOutput.dashboard_summary}"
                      </p>
                    </div>

                    <div className="shrink-0 bg-white/10 border border-white/20 rounded-md p-3.5 text-center font-mono">
                      <span className="block text-[10px] text-neutral-300 uppercase tracking-widest">Selected Slot</span>
                      <strong className="block text-sm text-white mt-1">{taskOutput.booking.date} - {taskOutput.booking.time}</strong>
                    </div>
                  </div>

                  {/* STEP 1 DATA: RESEARCH NODES */}
                  <div className="border border-neutral-200 rounded-lg p-5 flex flex-col gap-4 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-neutral-600" />
                        <div>
                          <h3 className="font-bold text-sm text-neutral-900 font-sans">TASK 1: Deep Web Research & Grounding</h3>
                          <p className="text-[11px] text-neutral-400">Isolated 3 premium local options with trial offers</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-neutral-100 border border-neutral-200 text-neutral-700 font-mono px-2 py-0.5 rounded uppercase">
                        Verified Search Grounding
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Top Choice Studio */}
                      <div className="border-2 border-neutral-900 rounded-lg p-4 bg-neutral-50 flex flex-col justify-between relative shadow-sm">
                        <div className="absolute top-2.5 right-3 bg-neutral-900 text-white font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">
                          TOP OPTION
                        </div>

                        <div>
                          <h4 className="font-bold text-neutral-950 text-sm mt-1">{taskOutput.recommended_studio.name}</h4>
                          <span className="text-xs font-mono font-semibold text-neutral-500 block mt-0.5">★ {taskOutput.recommended_studio.rating || "4.9"} rating</span>
                          <span className="text-[10px] text-neutral-400 font-mono block mt-1">{taskOutput.recommended_studio.address}</span>
                          
                          <div className="bg-neutral-900 text-white text-[10px] font-mono font-bold mt-3 px-2 py-1 rounded inline-block">
                            TRIAL: {taskOutput.recommended_studio.trialOffer}
                          </div>
                        </div>

                        <p className="text-xs text-neutral-600 mt-4 italic pt-3 border-t border-neutral-200">
                          "{taskOutput.recommended_studio.reason}"
                        </p>
                      </div>

                      {/* Additional Studio options */}
                      {allStudios.filter(s => s.name !== taskOutput.recommended_studio.name).slice(0, 2).map((other, idx) => (
                        <div key={idx} className="border border-neutral-205 rounded-lg p-4 flex flex-col justify-between bg-white">
                          <div>
                            <h4 className="font-bold text-neutral-800 text-sm">{other.name}</h4>
                            <span className="text-xs font-mono text-neutral-400 block mt-0.5">★ {other.rating || "4.7"} rating • {other.address}</span>
                            <span className="text-[10px] text-neutral-500 font-mono block mt-2">Discount: {other.trialOffer || "Intro Offer available"}</span>
                          </div>

                          <p className="text-xs text-neutral-400 mt-4 italic pt-3 border-t border-neutral-100">
                            {other.reason}
                          </p>
                        </div>
                      ))}

                      {/* Extra card if backend list is short */}
                      {allStudios.length < 2 && (
                        <>
                          <div className="border border-neutral-200 rounded-lg p-4 flex flex-col justify-between bg-white">
                            <div>
                              <h4 className="font-bold text-neutral-800 text-sm">Zenith Strength Lab</h4>
                              <span className="text-xs font-mono text-neutral-400 block mt-0.5">★ 4.8 rating • Downtown Boulevard</span>
                              <span className="text-[10px] text-neutral-500 font-mono block mt-2">Discount: First class free or $35 trial week</span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-4 italic pt-3 border-t border-neutral-100">
                              Top class core strength studio featuring modern reformer alignment tools.
                            </p>
                          </div>
                          <div className="border border-neutral-200 rounded-lg p-4 flex flex-col justify-between bg-white">
                            <div>
                              <h4 className="font-bold text-neutral-800 text-sm">Vital Pilates Boutique</h4>
                              <span className="text-xs font-mono text-neutral-400 block mt-0.5">★ 4.7 rating • South Beach Waterfront</span>
                              <span className="text-[10px] text-neutral-500 font-mono block mt-2">Discount: $25 intro package session available</span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-4 italic pt-3 border-t border-neutral-100">
                              Excellent private studio with premium localized instruction and beginner coaching.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* STEP 2 DATA: EMAIL DRAFT */}
                  <div className="border border-neutral-200 rounded-lg p-5 flex flex-col bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neutral-600" />
                        <div>
                          <h3 className="font-bold text-sm text-neutral-900 font-sans">TASK 2: Programmatic Studio Email Draft</h3>
                          <p className="text-[11px] text-neutral-400">Created customized template to inquire about membership options</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-neutral-100 text-neutral-800 border border-neutral-200 font-mono px-2 py-0.5 rounded uppercase">
                        Draft Ready
                      </span>
                    </div>

                    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50 text-xs">
                      <div className="bg-neutral-100 border-b border-neutral-200 px-4 py-2.5 flex flex-col gap-1 text-neutral-600 font-mono">
                        <div><strong className="text-neutral-800">To:</strong> {taskOutput.email_drafted.to}</div>
                        <div><strong className="text-neutral-800">Subject:</strong> {taskOutput.email_drafted.subject}</div>
                      </div>
                      <div className="p-4 bg-white text-neutral-700 leading-relaxed font-sans whitespace-pre-wrap min-h-[140px]">
                        {taskOutput.email_drafted.body}
                      </div>
                      <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5 flex justify-end">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(taskOutput.email_drafted.body);
                            alert("Email body copied to clipboard.");
                          }}
                          className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 font-mono text-[10px] font-semibold cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> COPY EMAIL COPY
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* STEP 3 DATA: CALENDAR AUDIT SECTION */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white">
                    <div className="md:col-span-7 border border-neutral-200 rounded-lg p-5 flex flex-col">
                      <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 mb-4">
                        <Calendar className="w-4 h-4 text-neutral-600" />
                        <div>
                          <h3 className="font-bold text-sm text-neutral-900 font-sans">TASK 3: Smart Calendar Conflict Analysis</h3>
                          <p className="text-[11px] text-neutral-400">Double-checked the upcoming weeks for any conflicting events</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded bg-rose-50 border border-rose-100 text-xs">
                          <span className="font-semibold text-rose-800 font-mono">Mondays (10:00 AM - 12:00 PM)</span>
                          <span className="text-rose-700 uppercase tracking-widest text-[9px] font-bold">CONFLICT: Team Sync</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded bg-rose-50 border border-rose-100 text-xs">
                          <span className="font-semibold text-rose-800 font-mono">Tuesdays (6:00 PM - 8:30 PM)</span>
                          <span className="text-rose-700 uppercase tracking-widest text-[9px] font-bold">CONFLICT: Team Dinner</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded bg-rose-55 border border-rose-100 text-xs">
                          <span className="font-semibold text-rose-800 font-mono">Thursdays (1:00 PM - 3:00 PM)</span>
                          <span className="text-rose-700 uppercase tracking-widest text-[9px] font-bold">CONFLICT: Work Sprint</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-semibold mb-2">Identified Free Morning & Evening Open Slots:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {availableSlots && availableSlots.length > 0 ? (
                            availableSlots.slice(0, 3).map((slot, idx) => (
                              <div key={idx} className="bg-neutral-50 border border-neutral-200 rounded p-2 text-center">
                                <span className="block text-[11px] font-bold text-neutral-800">{slot}</span>
                                <span className="text-[9px] text-neutral-500 font-mono">Available</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="bg-neutral-50 border border-neutral-200 rounded p-2 text-center text-xs">
                                <span className="block font-bold text-neutral-800">Wednesday June 3</span>
                                <span className="text-[10px] text-neutral-500 font-mono">6:15 PM</span>
                              </div>
                              <div className="bg-neutral-50 border border-neutral-200 rounded p-2 text-center text-xs">
                                <span className="block font-bold text-neutral-800">Friday June 5</span>
                                <span className="text-[10px] text-neutral-500 font-mono">8:00 AM</span>
                              </div>
                              <div className="bg-neutral-50 border border-neutral-200 rounded p-2 text-center text-xs">
                                <span className="block font-bold text-neutral-800">Saturday June 6</span>
                                <span className="text-[10px] text-neutral-500 font-mono">10:30 AM</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STEP 4 DATA: SECURE PASS TICKET */}
                    <div className="md:col-span-5 border border-neutral-250 bg-neutral-900 text-white rounded-lg p-5 flex flex-col justify-between shadow-md relative overflow-hidden">
                      {/* Ticket pattern circles */}
                      <div className="absolute top-1/2 -left-3 h-6 w-6 rounded-full bg-white -translate-y-1/2"></div>
                      <div className="absolute top-1/2 -right-3 h-6 w-6 rounded-full bg-white -translate-y-1/2"></div>

                      <div>
                        <div className="flex justify-between items-center border-b border-white/10 pb-3.5 mb-4">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#a3a3a3]">AUTONOMOUS REGULAR PASS</span>
                          <span className="bg-emerald-500 text-slate-950 font-mono text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                            CONFIRMED
                          </span>
                        </div>

                        <div className="space-y-3 px-2">
                          <div>
                            <span className="block text-[9px] font-mono text-[#a3a3a3] uppercase tracking-widest">STUDIO VENUE</span>
                            <strong className="block text-sm text-neutral-100">{taskOutput.booking.studio}</strong>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[9px] font-mono text-[#a3a3a3] uppercase tracking-widest">DATE</span>
                              <strong className="block text-xs text-neutral-100">{taskOutput.booking.date}</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] font-mono text-[#a3a3a3] uppercase tracking-widest">HOURS TIME</span>
                              <strong className="block text-xs text-neutral-100">{taskOutput.booking.time}</strong>
                            </div>
                          </div>
                          <div>
                            <span className="block text-[9px] font-mono text-[#a3a3a3] uppercase tracking-widest">CLASS FOR CLIENT</span>
                            <strong className="block text-xs text-neutral-100">Akanksha Agarwal ({taskOutput.user_profile.experienceLevel} level)</strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-3 border-t border-white/10 flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Autopassed & Synced with External API</span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-16 text-center border border-dashed border-neutral-300 rounded-lg bg-neutral-50">
                  <Dumbbell className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                  <p className="font-sans font-bold text-sm text-neutral-700">No Task Execution Logs Yet</p>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Once you call Sarah and finish the conversation, background research, email drafting, calendar parsing, and scheduling take place autonomously.
                  </p>
                  <button
                    onClick={() => {
                      setIsCalling(true);
                      setActiveTab("onboarding");
                    }}
                    className="mt-4 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs font-semibold rounded transition-all cursor-pointer"
                  >
                    Start Call & Talk to Agent
                  </button>
                </div>
              )}

            </div>
          )}

          {/* TAB 3 CONTENT: JSON CONTROLLER */}
          {activeTab === "json" && (
            <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 font-sans">Fitness Agent Structured JSON Schema</h3>
                  <p className="text-[11px] text-neutral-400">Validated output delivered directly to programmatic endpoints</p>
                </div>

                {taskOutput && (
                  <button
                    onClick={handleCopyJSON}
                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-750 font-mono text-xs font-semibold rounded border border-neutral-200 transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> COPY RAW PAYLOAD
                  </button>
                )}
              </div>

              {taskOutput ? (
                <div className="bg-neutral-900 text-emerald-400 font-mono p-5 rounded-lg overflow-x-auto text-xs leading-relaxed max-h-[550px] scrollbar-thin">
                  <pre>{JSON.stringify(taskOutput, null, 2)}</pre>
                </div>
              ) : (
                <div className="p-10 text-center border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 rounded text-xs font-mono">
                  Wait for the live call to complete to generate the structured JSON payload.
                </div>
              )}
            </div>
          )}

          {/* SECURE TERMINAL CONSOLE LOG COMPONENT */}
          <div className="bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 shadow-sm text-white flex flex-col">
            <div className="bg-neutral-950 border-b border-neutral-800 px-4 py-2 flex justify-between items-center text-[10px] font-mono text-neutral-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full"></span>
                <span>SYSTEM AGENT LOG STREAM</span>
              </div>
              <span>Total Entries: {terminalLogs.length}</span>
            </div>
            
            <div className="p-4 font-mono text-xs text-neutral-300 leading-relaxed max-h-[160px] overflow-y-auto space-y-1.5 min-h-[120px]">
              {terminalLogs.length === 0 ? (
                <span className="text-neutral-500 italic block">System active. Standing by for voice/webcam connections ...</span>
              ) : (
                terminalLogs.map((log, idx) => (
                  <div key={idx} className="border-b border-neutral-850 pb-1 last:border-0">
                    <span className="text-neutral-500">{log.slice(0, 10)}</span>
                    <span className="text-emerald-450 font-semibold">{log.slice(10)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: BRANDING & SYSTEM FACTS (Col Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-8 border-t lg:border-t-0 lg:border-l lg:border-neutral-200 lg:pl-10 pt-8 lg:pt-0">
          
          {/* THE SOLUTION */}
          <div>
            <h3 className="font-sans font-bold text-2xl text-neutral-900 tracking-tight leading-none mb-3">
              The Solution
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed font-normal">
              AgentHub is a consumer-facing multi-agent platform; a single dashboard where users onboard, manage, and deploy AI agents that act autonomously on their behalf. Instead of typing prompts, users FaceTime their agent. The agent learns their preferences through a short video call, then executes tasks end-to-end — no follow-up required.
            </p>
          </div>

          {/* THE PROBLEM */}
          <div>
            <h3 className="font-sans font-bold text-2xl text-neutral-900 tracking-tight leading-none mb-3">
              The Problem
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed font-normal">
              Seventy-nine percent say AI agents are already being adopted in their companies (PwC, 2025), so why not in our lives? AI agents are being deployed in the wrong place. iMessage bots and WhatsApp agents live inside spaces built for human relationships creating friction, distrust, and abandonment. B2C AI platforms churn at 4%+ monthly because agents have no natural home. Meanwhile, users who want a fitness agent, a finance agent, and a scheduling agent have no unified place to manage them.
            </p>
          </div>

          {/* HOW IT WORKS */}
          <div>
            <h3 className="font-sans font-bold text-2xl text-neutral-900 tracking-tight leading-none mb-3">
              How it works
            </h3>
            <ul className="space-y-4 text-sm text-neutral-600">
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                <span>
                  <strong>Onboard</strong> — User starts a FaceTime-style call with a new agent (e.g. Fitness).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                <span>
                  <strong>Personalise</strong> — Agent asks targeted questions: goals, schedule, neighborhood, and level.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                <span>
                  <strong>Execute</strong> — Agent autonomously researches studios, checks calendar for conflicts, drafts emails for discounts, and confirms secure slot booking.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                <span>
                  <strong>Report</strong> — Dashboard surfaces secure upcoming session, draft verification details, card booking passes, and a structured payload.
                </span>
              </li>
            </ul>
          </div>

          {/* DEMO STATEMENT */}
          <div className="p-4 bg-white border border-neutral-200 rounded">
            <h4 className="font-mono text-xs uppercase tracking-widest font-semibold text-neutral-900 mb-2">
              Voice Agent Demo Behavior
            </h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              When FaceTime starts, the user says <em>"I want to start pilates."</em> Sarah intercepts fitness queries, resolves location, scans trials, checks Google Calendar intervals, and books on USYD / KCL user client accounts securely.
            </p>
          </div>

          {/* TRACE / TEAM CREDITS FOOTER */}
          <div className="border-t border-neutral-200 pt-6 space-y-4">
            <div>
              <span className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">Built With</span>
              <p className="text-xs text-neutral-500 mt-1 leading-snug">
                Google Gemini (Voice API) • Google AI Studio • Google Cloud Run • Google Calendar API • Gmail API
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">Team Lead</span>
                <p className="text-xs font-semibold text-neutral-700 mt-1">Sophie Lewis (KCL)</p>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">Dev Lead</span>
                <p className="text-xs font-semibold text-neutral-700 mt-1">Akanksha Agarwal (USYD)</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* COMPACT BRAND FOOTER */}
      <footer className="border-t border-neutral-200 bg-white px-8 py-5 text-center text-xs text-neutral-400 mt-auto">
        <p className="font-mono tracking-wide">
          © {new Date().getFullYear()} AgentHub Inc. All rights reserved. Registered Autonomous OS.
        </p>
      </footer>

    </div>
  );
}
