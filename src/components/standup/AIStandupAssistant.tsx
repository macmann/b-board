"use client";

import { FormEvent, useMemo, useState } from "react";

import Button from "@/components/ui/Button";

type StandupDraft = {
  yesterday: string;
  today: string;
  blockers: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type Props = {
  projectId: string;
  userName: string;
  onDraftReady: (draft: StandupDraft) => void;
};

const questionFlow = [
  { key: "yesterday" as const, prompt: "What did you work on yesterday?" },
  { key: "today" as const, prompt: "What will you work on today?" },
  { key: "blockers" as const, prompt: "Any blockers or risks?" },
];

export default function AIStandupAssistant({
  projectId,
  userName,
  onDraftReady,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "assistant",
      content:
        "AI will ask you a few questions about yesterday, today, and blockers, then fill your stand-up form.",
    },
    { role: "assistant", content: questionFlow[0].prompt },
  ]);
  const [answers, setAnswers] = useState<StandupDraft>({
    yesterday: "",
    today: "",
    blockers: "",
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = useMemo(
    () => questionFlow[currentStep] ?? questionFlow[questionFlow.length - 1],
    [currentStep]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!input.trim() || isDrafting) return;

    const trimmed = input.trim();
    const isLastStep = currentStep === questionFlow.length - 1;
    const updatedAnswers = { ...answers, [currentQuestion.key]: trimmed } as StandupDraft;
    const nextPrompt = questionFlow[currentStep + 1]?.prompt ?? "";

    setMessages((prev: ChatMessage[]) => {
      const nextMessages: ChatMessage[] = [
        ...prev,
        { role: "user", content: trimmed },
      ];
      const assistantPrompt: ChatMessage = {
        role: "assistant",
        content: nextPrompt,
      };

      if (!isLastStep) {
        return [...nextMessages, assistantPrompt];
      }

      return nextMessages;
    });

    setAnswers(updatedAnswers);
    setInput("");
    setError(null);

    if (!isLastStep) {
      setCurrentStep((prev) => Math.min(prev + 1, questionFlow.length - 1));
      return;
    }

    setIsDrafting(true);

    try {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Let me turn that into a concise stand-up draft...",
        },
      ]);

      const response = await fetch("/api/standups/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          yesterdayAnswer: updatedAnswers.yesterday,
          todayAnswer: updatedAnswers.today,
          blockersAnswer: updatedAnswers.blockers,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Unable to generate stand-up draft");
      }

      const draft = (await response.json()) as StandupDraft;

      onDraftReady({
        yesterday: draft.yesterday ?? updatedAnswers.yesterday,
        today: draft.today ?? updatedAnswers.today,
        blockers: draft.blockers ?? updatedAnswers.blockers,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Draft ready! I've filled in your stand-up form so you can review and submit.",
        },
      ]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while drafting your stand-up.";
      setError(message);
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-inner dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          AI will collect your answers and fill in the stand-up form for you to review.
        </p>
        <div className="flex gap-2">
          <Button disabled variant="secondary">
            Use microphone (coming soon)
          </Button>
          {/* TODO: Wire this button to OpenAI Realtime / voice capture once available. */}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Conversation
        </p>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex items-start gap-2 ${
                message.role === "assistant" ? "text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  message.role === "assistant"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                }`}
              >
                {message.role === "assistant" ? "AI" : userName?.[0]?.toUpperCase() || "You"}
              </span>
              <p className="flex-1 whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {currentQuestion.prompt}
          </label>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="Type your answer"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Step {Math.min(currentStep + 1, questionFlow.length)} of {questionFlow.length}
          </p>
          <Button type="submit" disabled={isDrafting}>
            {isDrafting ? "Generating draft..." : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
