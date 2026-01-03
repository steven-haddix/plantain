# Vercel AI SDK v6 (Beta) Reference Guide

> **Note:** AI SDK 6 is currently in beta. APIs may change in patch releases. Pin to specific versions for stability.

## Installation

```bash
npm install ai@beta @ai-sdk/openai@beta @ai-sdk/react@beta
# Or with other providers:
npm install @ai-sdk/anthropic@beta @ai-sdk/google@beta
```

## Quick Links

- **V6 Documentation:** https://v6.ai-sdk.dev/docs/introduction
- **V6 Announcement:** https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta
- **API Reference:** https://v6.ai-sdk.dev/docs/reference/ai-sdk-core
- **LLM-friendly docs:** https://ai-sdk.dev/llms.txt
- **Providers:** https://v6.ai-sdk.dev/providers
- **GitHub:** https://github.com/vercel/ai

---

## Core Concepts

The AI SDK has two main modules:

- **AI SDK Core** (`ai`): Server-side functions for generating text, objects, tool calls, and building agents
- **AI SDK UI** (`@ai-sdk/react`, `@ai-sdk/svelte`, `@ai-sdk/vue`): Client-side hooks for chat interfaces

---

## Provider Setup

### Using Vercel AI Gateway (Recommended)
No provider package needed - use model strings directly:

```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',  // or 'openai/gpt-4o'
  prompt: 'Hello!',
});
```

### Using Provider Packages Directly

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// Anthropic
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Hello!',
});

// OpenAI
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
});
```

### Provider Configuration

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Custom settings
});
```

**Provider Docs:**
- Anthropic: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
- OpenAI: https://ai-sdk.dev/providers/ai-sdk-providers/openai
- Google: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai

---

## Text Generation

### generateText (Non-streaming)

```typescript
import { generateText } from 'ai';

const { text, toolCalls, toolResults, usage, finishReason } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a helpful assistant.',
  prompt: 'What is the capital of France?',
  // Or use messages array:
  // messages: [{ role: 'user', content: 'Hello' }],
});
```

**Reference:** https://v6.ai-sdk.dev/docs/ai-sdk-core/generating-text

### streamText (Streaming)

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a helpful assistant.',
  messages,
});

// For Next.js API routes:
return result.toUIMessageStreamResponse();

// Or for text-only streams:
return result.toTextStreamResponse();
```

**Key streamText callbacks:**

```typescript
const result = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  messages,
  onChunk: ({ chunk }) => {
    // Handle each chunk
  },
  onFinish: ({ text, usage, finishReason }) => {
    // Handle completion
  },
  onError: (error) => {
    // Handle errors
  },
});
```

**Reference:** https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

---

## Structured Data Generation

### generateObject

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: 'anthropic/claude-sonnet-4.5',
  schema: z.object({
    name: z.string(),
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.string(),
    })),
    steps: z.array(z.string()),
  }),
  prompt: 'Generate a lasagna recipe.',
});
```

### streamObject

```typescript
import { streamObject } from 'ai';

const result = streamObject({
  model: 'anthropic/claude-sonnet-4.5',
  schema: z.object({ ... }),
  prompt: 'Generate a recipe.',
});

// Get partial updates
for await (const partialObject of result.partialObjectStream) {
  console.log(partialObject);
}

// Or wait for final object
const finalObject = await result.object;
```

### Output Strategies

```typescript
// Array output
const { object } = await generateObject({
  model: 'openai/gpt-4o',
  output: 'array',
  schema: z.object({ name: z.string(), description: z.string() }),
  prompt: 'Generate 3 recipes',
});

// Enum output (classification)
const { object } = await generateObject({
  model: 'openai/gpt-4o',
  output: 'enum',
  enum: ['positive', 'negative', 'neutral'],
  prompt: 'Classify: "I love this product!"',
});
```

**Reference:** https://v6.ai-sdk.dev/docs/ai-sdk-core/generating-structured-data

---

## Tool Calling

### Defining Tools

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    city: z.string().describe('The city name'),
    unit: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  execute: async ({ city, unit }) => {
    // Fetch weather data
    return { temperature: 22, condition: 'sunny' };
  },
});
```

### Using Tools with generateText/streamText

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const { text, toolCalls, toolResults } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  tools: {
    weather: tool({
      description: 'Get weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temp: 22, condition: 'sunny' }),
    }),
  },
  prompt: 'What is the weather in Paris?',
});
```

### Tool Approval (v6 Feature)

```typescript
const result = await generateText({
  model: 'openai/gpt-4o',
  tools: {
    deleteFile: tool({
      description: 'Delete a file',
      inputSchema: z.object({ path: z.string() }),
      needsApproval: true,  // Requires user confirmation
      execute: async ({ path }) => { /* ... */ },
    }),
  },
  prompt: 'Delete the temp file',
});
```

**Reference:** https://v6.ai-sdk.dev/docs/foundations/tools

---

## Agents (v6 Feature)

### ToolLoopAgent

The new `ToolLoopAgent` class simplifies building multi-step agents:

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai';

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a helpful assistant with access to tools.',
  tools: {
    search: tool({ /* ... */ }),
    calculate: tool({ /* ... */ }),
  },
  stopWhen: stepCountIs(10),  // Max 10 steps
});

// Generate text
const { text, steps } = await agent.generateText({
  prompt: 'Research and summarize recent AI news',
});

// Or stream
const result = agent.streamText({
  messages,
});
```

### Agent with Structured Output

```typescript
import { ToolLoopAgent, Output } from 'ai';

const agent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  tools: { /* ... */ },
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      sources: z.array(z.string()),
    }),
  }),
});

const { output } = await agent.generateText({
  prompt: 'Research AI trends and provide a summary with sources',
});
```

### Custom Stop Conditions

```typescript
import { stepCountIs, hasNoToolCalls } from 'ai';

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  tools: { /* ... */ },
  stopWhen: stepCountIs(20),  // Default is 20 steps
});
```

**Reference:** https://v6.ai-sdk.dev/docs/agents/building-agents

---

## AI SDK UI (React)

### useChat Hook

```typescript
'use client';
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.role}:</strong>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={index}>{part.text}</span>;
            }
            if (part.type === 'tool-weather') {
              return <WeatherCard key={index} data={part} />;
            }
          })}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
```

### API Route (Next.js App Router)

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a helpful assistant.',
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

### useObject Hook

```typescript
'use client';
import { useObject } from '@ai-sdk/react';
import { z } from 'zod';

const schema = z.object({
  recipe: z.object({
    name: z.string(),
    ingredients: z.array(z.string()),
  }),
});

export default function RecipeGenerator() {
  const { object, submit, isLoading } = useObject({
    api: '/api/generate-recipe',
    schema,
  });

  return (
    <div>
      <button onClick={() => submit('Generate a pasta recipe')}>
        Generate
      </button>
      {object && <div>{object.recipe?.name}</div>}
    </div>
  );
}
```

**Reference:** https://v6.ai-sdk.dev/docs/ai-sdk-ui/overview

---

## Model Context Protocol (MCP)

### Creating an MCP Client

```typescript
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { generateText } from 'ai';

const client = await experimental_createMCPClient({
  transport: {
    type: 'http',
    url: 'https://your-mcp-server.com/mcp',
  },
});

const tools = await client.tools();

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  tools,
  prompt: 'Use available tools to help me.',
});

// Always close when done
await client.close();
```

### MCP with stdio (Local Development)

```typescript
const client = await experimental_createMCPClient({
  transport: {
    type: 'stdio',
    command: 'node',
    args: ['./mcp-server.js'],
  },
});
```

**Reference:** https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools

---

## Anthropic-Specific Features

### Reasoning/Thinking Mode

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const { text, reasoning } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Solve this complex problem...',
  providerOptions: {
    anthropic: {
      thinking: { budgetTokens: 10000 },
    },
  },
});
```

### Effort Setting (Claude Opus 4.5)

```typescript
const result = await generateText({
  model: anthropic('claude-opus-4-5-20251101'),
  prompt: 'Quick question...',
  providerOptions: {
    anthropic: {
      effort: 'low',  // 'low' | 'medium' | 'high' (default)
    },
  },
});
```

### Web Search Tool

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: {
    web_search: anthropic.tools.webSearch({
      maxSearches: 5,
    }),
  },
  prompt: 'What happened in tech news today?',
});
```

---

## Key v6 Changes from v5

| v5 | v6 |
|----|----|
| `maxSteps` | `stopWhen: stepCountIs(N)` |
| `parameters` (tools) | `inputSchema` |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` |
| `append()` (useChat) | `sendMessage({ text: '...' })` |
| `message.content` | `message.parts[]` array |

---

## Common Patterns

### Next.js App Router Chat API

```typescript
// app/api/chat/route.ts
import { streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a helpful assistant.',
    messages,
    tools: {
      getWeather: tool({
        description: 'Get weather for a location',
        inputSchema: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => {
          return { temperature: 22, condition: 'sunny' };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Error Handling

```typescript
import { generateText, AI_NoObjectGeneratedError } from 'ai';

try {
  const { object } = await generateObject({
    model: 'anthropic/claude-sonnet-4.5',
    schema: mySchema,
    prompt: 'Generate data',
  });
} catch (error) {
  if (error instanceof AI_NoObjectGeneratedError) {
    console.log('Failed to generate:', error.text);
    console.log('Cause:', error.cause);
  }
}
```

---

## Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

---

## Additional Resources

- **Getting Started (Next.js):** https://v6.ai-sdk.dev/docs/getting-started/nextjs-app-router
- **Getting Started (Node.js):** https://v6.ai-sdk.dev/docs/getting-started/nodejs
- **Workflow Patterns:** https://v6.ai-sdk.dev/docs/agents/workflows
- **Error Handling:** https://v6.ai-sdk.dev/docs/ai-sdk-core/error-handling
- **Telemetry:** https://v6.ai-sdk.dev/docs/ai-sdk-core/telemetry
- **Testing:** https://v6.ai-sdk.dev/docs/ai-sdk-core/testing
- **Vercel Community:** https://community.vercel.com/c/ai-sdk/62
