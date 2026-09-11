import type { Step } from '../types';
import { keywordParser } from './keywordParser';

export type PendingQuestion = 'hold-5000';

export interface ParseContext {
  pending?: PendingQuestion | null;
  /** Names of the practice's saved sign-ins, so "log in with billing read-only" can pick one. */
  signIns?: string[];
}

export interface ParseResult {
  steps: Step[];
  /** Short plain sentence shown in chat. Never code, never a selector. */
  reply: string;
  question?: PendingQuestion;
}

/** Layer A uses the keyword parser; Layer B can swap in an LLM with the same signature. */
export interface InstructionParser {
  parse(text: string, current: Step[], ctx?: ParseContext): ParseResult;
}

export const parser: InstructionParser = keywordParser;
