import type { NextApiRequest, NextApiResponse } from "next";

import { verifyAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";
import openai from "@/lib/openai";

type StandupDraft = {
  yesterday: string;
  today: string;
  blockers: string;
};

const toText = (value: unknown) => (typeof value === "string" ? value : "");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { projectId, yesterdayAnswer, todayAnswer, blockersAnswer } =
    req.body ?? {};

  if (!projectId || typeof projectId !== "string") {
    return res.status(400).json({ message: "projectId is required" });
  }

  const token = req.cookies?.auth_token;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, email: true },
  });

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userLabel = user.name || user.email || "team member";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that converts free-form answers into a concise daily stand-up entry with fields: yesterday, today, blockers. Respond with JSON only.",
        },
        {
          role: "user",
          content: [
            `User: ${userLabel}`,
            `Project: ${projectId}`,
            `Yesterday: ${toText(yesterdayAnswer) || "(not provided)"}`,
            `Today: ${toText(todayAnswer) || "(not provided)"}`,
            `Blockers: ${toText(blockersAnswer) || "(none)"}`,
            'Return JSON with keys "yesterday", "today", and "blockers".',
          ].join("\n"),
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    let draft: StandupDraft | null = null;

    if (content) {
      try {
        draft = JSON.parse(content) as StandupDraft;
      } catch (error) {
        console.error("Failed to parse AI draft response", error);
      }
    }

    if (
      !draft ||
      typeof draft.yesterday !== "string" ||
      typeof draft.today !== "string" ||
      typeof draft.blockers !== "string"
    ) {
      draft = {
        yesterday: toText(yesterdayAnswer),
        today: toText(todayAnswer),
        blockers: toText(blockersAnswer),
      };
    }

    return res.status(200).json(draft);
  } catch (error) {
    console.error("Error creating standup AI draft", error);
    return res
      .status(500)
      .json({ message: "Unable to create AI stand-up draft" });
  }
}
