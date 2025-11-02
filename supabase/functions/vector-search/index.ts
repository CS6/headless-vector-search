import "xhr";
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import GPT3Tokenizer from "gpt3-tokenizer";
import { Configuration, CreateCompletionRequest, OpenAIApi } from "openai";
import { ensureGetEnv } from "../_utils/env.ts";
import { ApplicationError, UserError } from "../_utils/errors.ts";
import { buildSearchPrompt } from "../_utils/prompt.ts";
import { enhanceQuery } from "../_utils/query-enhancer.ts";

const OPENAI_API_KEY = ensureGetEnv("OPENAI_API_KEY");
const SUPABASE_URL = ensureGetEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = ensureGetEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "docs" },
});
const openAiConfiguration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(openAiConfiguration);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const query = new URL(req.url).searchParams.get("query");

    if (!query) {
      throw new UserError("Missing query in request data");
    }

    const sanitizedQuery = query.trim();

    // 驗證查詢長度
    if (sanitizedQuery.length < 2) {
      throw new UserError("Query is too short. Please provide a more detailed question.");
    }

    // 增強查詢以提高匹配率（例如：將中文數字轉換為阿拉伯數字）
    const enhancedQuery = enhanceQuery(sanitizedQuery);
    console.log(`Original query: "${sanitizedQuery}", Enhanced query: "${enhancedQuery}"`);

    // Moderate the content to comply with OpenAI T&C
    // 添加錯誤處理，如果 moderation 失敗則跳過（可選）
    try {
      const moderationResponse = await openai.createModeration({
        input: sanitizedQuery,
      });

      if (moderationResponse.data && moderationResponse.data.results) {
        const [results] = moderationResponse.data.results;

        if (results.flagged) {
          throw new UserError("Flagged content", {
            flagged: true,
            categories: results.categories,
          });
        }
      }
    } catch (moderationError: unknown) {
      // 如果 moderation API 失敗，記錄錯誤但繼續執行
      // 這確保服務不會因為 OpenAI moderation 的暫時性問題而中斷
      console.error("Moderation API error (continuing anyway):", moderationError);
      // 可選擇：如果希望嚴格檢查，可以取消下面的註解
      // throw new ApplicationError("Content moderation check failed", moderationError);
    }

    // 使用增強後的查詢來生成 embedding
    const embeddingResponse = await openai.createEmbedding({
      model: "text-embedding-3-small",
      input: enhancedQuery.replaceAll("\n", " "),
    });

    if (embeddingResponse.status !== 200) {
      throw new ApplicationError(
        "Failed to create embedding for question",
        embeddingResponse
      );
    }

    const [{ embedding }] = embeddingResponse.data.data;

    // 先嘗試較低的閾值，如果找不到結果再降低
    let matchThreshold = 0.3; // 降低閾值以提高匹配率（特別是針對數字查詢）
    let matchCount = 15; // 增加匹配數量以便有更多候選

    const { error: matchError, data: pageSections } = await supabaseClient.rpc(
      "match_page_sections",
      {
        embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        min_content_length: 20, // 降低最小內容長度以包含更多結果
      }
    );

    if (matchError) {
      throw new ApplicationError("Failed to match page sections", matchError);
    }

    // 記錄匹配結果以便調試
    console.log(`Found ${pageSections?.length || 0} matching sections`);
    if (pageSections && pageSections.length > 0) {
      console.log(`Top match similarity: ${pageSections[0]?.similarity}`);
    }

    // 檢查是否找到匹配的內容
    if (!pageSections || pageSections.length === 0) {
      throw new UserError("No relevant content found in the documentation. Please try rephrasing your question or check if the documentation has been ingested.");
    }

    const tokenizer = new GPT3Tokenizer({ type: "gpt3" });
    let tokenCount = 0;
    let contextText = "";

    for (const pageSection of pageSections) {
      const content = pageSection.content;
      const encoded = tokenizer.encode(content);
      tokenCount += encoded.text.length;

      if (tokenCount >= 1500) {
        break;
      }

      contextText += `${content.trim()}\n---\n`;
    }

    // 如果沒有 context，返回錯誤
    if (!contextText.trim()) {
      throw new UserError("No content was extracted from the documentation. Please try rephrasing your question.");
    }

    // 使用獨立的 prompt 模組建立提示詞
    const prompt = buildSearchPrompt(contextText, sanitizedQuery);

    const completionOptions: CreateCompletionRequest = {
      model: "gpt-3.5-turbo-instruct",
      prompt,
      max_tokens: 512,
      temperature: 0,
      stream: true,
    };

    // The Fetch API allows for easier response streaming over the OpenAI client.
    const response = await fetch("https://api.openai.com/v1/completions", {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(completionOptions),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApplicationError("Failed to generate completion", error);
    }

    // Proxy the streamed SSE response from OpenAI
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (err: unknown) {
    if (err instanceof UserError) {
      return Response.json(
        {
          error: err.message,
          data: err.data,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    } else if (err instanceof ApplicationError) {
      // Print out application errors with their additional data
      console.error(`${err.message}: ${JSON.stringify(err.data)}`);
    } else {
      // Print out unexpected errors as is to help with debugging
      console.error(err);
    }

    // TODO: include more response info in debug environments
    return Response.json(
      {
        error: "There was an error processing your request",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
