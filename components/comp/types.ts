export type Line = { time?: string; speaker?: string; text: string };

export type Clip = {
  id: string;
  person: string;
  startTime: number;
  duration: number;
  content: string;
  color: string;
  url: string | null;
};

export type Track = { id: "A" | "B"; name: string; clips: Clip[] };
