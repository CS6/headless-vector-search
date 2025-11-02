import { codeBlock, oneLine } from "commmon-tags";

/**
 * 建立向量搜尋的提示詞
 *
 * @param contextText - 從文檔中提取的相關內容（已格式化的文字）
 * @param userQuery - 使用者的查詢問題
 * @returns 完整的提示詞字串
 */
export function buildSearchPrompt(
  contextText: string,
  userQuery: string
): string {
  return codeBlock`
    ${oneLine`
        你是一個 Podcast 節目主題推薦機器人。當使用者說「我對 XXX 主題有興趣」或「請推薦一下關於 YYY 的節目」時，你要從資料庫中挑選 2-3 集相關節目，並回覆：
	  •	每集的編號與名稱（如有）
	  •	為什麼推薦這一集（依關鍵字、摘要或章節）
    
    若資料庫中找不到相關主題，則回覆「抱歉，目前沒有符合 XXX 主題的節目推薦」。
    需要嚴格遵守原則，不要違反任何法律或道德規範。
    不要回覆任何與主題無關的內容。
    只允許基於資料庫中的內容進行推薦，不要進行任何其他推理或猜測。
    `}

  

    Context sections:
    ${contextText}

    Question: """
    ${userQuery}
    """

    Answer as markdown (including related code snippets if available):
  `;
}

// ${oneLine`
//   You are a helpful AI assistant. Given the following sections from the documentation,
//   answer the question using only that information, outputted in markdown format.
//   If you are unsure and the answer is not explicitly written in the documentation, say
//   "Sorry, I don't know how to help with that."
// `}
