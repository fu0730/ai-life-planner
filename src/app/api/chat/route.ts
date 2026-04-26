import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt } from '@/lib/ai';
import { aiFunctionDeclarations } from '@/lib/ai-actions';
import type { Task, Routine, UserProfile, Category } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ChatRequest {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: {
    tasks: Task[];
    routines: Routine[];
    profile: UserProfile | null;
    categories: Category[];
  };
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { message, history, context } = body;

    const systemPrompt = buildSystemPrompt(context);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations:
            aiFunctionDeclarations as Parameters<
              typeof genAI.getGenerativeModel
            >[0]['tools'] extends (infer T)[]
              ? T extends { functionDeclarations?: infer F }
                ? F
                : never
              : never,
        },
      ],
    });

    const chat = model.startChat({
      history: history.map((h) => ({
        role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: h.content }],
      })),
    });

    // Function Calling対応: まず非ストリーミングで送信してfunction callを確認
    const result = await chat.sendMessage(message);
    const response = result.response;
    const functionCalls = response.functionCalls();

    const encoder = new TextEncoder();

    if (functionCalls && functionCalls.length > 0) {
      const actions = functionCalls.map((fc) => ({
        type: fc.name,
        params: fc.args,
      }));

      // 関数結果をGeminiに返送（成功を通知）
      const functionResponseParts = functionCalls.map((fc) => ({
        functionResponse: {
          name: fc.name,
          response: {
            success: true,
            message: `${fc.name}のアクションをユーザーに提案しました`,
          },
        },
      }));

      // フォローアップテキストをストリーミングで取得
      const followUpResult = await chat.sendMessageStream(
        functionResponseParts
      );

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // アクション行を先に送信
            if (actions.length > 0) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ type: 'actions', data: actions }) + '\n'
                )
              );
            }

            // テキストをストリーミング送信
            for await (const chunk of followUpResult.stream) {
              const text = chunk.text();
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ type: 'text', content: text }) + '\n'
                  )
                );
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      });
    } else {
      // Function Callなし — テキストをそのまま返す
      const text = response.text();

      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: 'text', content: text }) + '\n'
            )
          );
          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
