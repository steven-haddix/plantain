# Vercel AI SDK v6 + Google (via AI Gateway)

> **v6 Beta** - Pin versions as APIs may change.

## Installation

```bash
npm install ai@beta @ai-sdk/react@beta
```

No Google provider package needed when using AI Gateway.

## Quick Links

- **V6 Docs:** https://v6.ai-sdk.dev/docs/introduction
- **AI Gateway:** https://vercel.com/ai-gateway
- **AI Gateway Models:** https://vercel.com/ai-gateway/models
- **Google Models:** https://v6.ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai

---

## Basic Usage

```typescript
import { generateText, streamText } from 'ai';

// Non-streaming
const { text } = await generateText({
  model: 'google/gemini-3-flash',
  prompt: 'Hello!',
});

// Streaming
const result = streamText({
  model: 'google/gemini-3-flash',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Available Google Models (Dec 2025)

```typescript
// Gemini 3 (Latest)
'google/gemini-3-flash'           // Best speed + intelligence, recommended default
'google/gemini-3.0-pro-preview'   // Most intelligent, reasoning model (1M context)

// Gemini 2.5
'google/gemini-2.5-pro'           // State-of-the-art reasoning/thinking
'google/gemini-2.5-flash'         // Great price-performance, good for agents
'google/gemini-2.5-flash-lite'    // Fastest, most cost-efficient
```

### Gemini 3 Pro with Thinking/Reasoning

```typescript
const { text } = await generateText({
  model: 'google/gemini-3.0-pro-preview',
  prompt: 'Solve this complex problem...',
  providerOptions: {
    google: {
      includeThoughts: true,  // Enable reasoning output
    },
  },
});
```

---

## Structured Output

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: 'google/gemini-2.0-flash',
  schema: z.object({
    name: z.string(),
    ingredients: z.array(z.string()),
  }),
  prompt: 'Generate a pasta recipe',
});
```

---

## Tool Calling

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const { text } = await generateText({
  model: 'google/gemini-2.0-flash',
  tools: {
    weather: tool({
      description: 'Get weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temp: 22, condition: 'sunny' }),
    }),
  },
  prompt: 'What is the weather in Tokyo?',
});
```

---

## Agent (Multi-step)

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai';

const agent = new ToolLoopAgent({
  model: 'google/gemini-2.0-flash',
  system: 'You are a helpful assistant.',
  tools: { /* your tools */ },
  stopWhen: stepCountIs(10),
});

const { text } = await agent.generateText({
  prompt: 'Research and summarize...',
});
```

---

## Next.js API Route

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: 'google/gemini-2.0-flash',
    system: 'You are a helpful assistant.',
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

---

## React Client

```typescript
'use client';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function Chat() {
  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState('');

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.parts.map((p, i) => p.type === 'text' && <span key={i}>{p.text}</span>)}
        </div>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage({ text: input }); setInput(''); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={status !== 'ready'} />
      </form>
    </div>
  );
}
```

---

## Key v6 Changes

| v5 | v6 |
|----|----|
| `maxSteps` | `stopWhen: stepCountIs(N)` |
| `parameters` | `inputSchema` |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` |
| `append()` | `sendMessage({ text: '...' })` |
| `message.content` | `message.parts[]` |