/**
 * 將中文數字轉換為阿拉伯數字
 * 支援：一、二、三...十、十一、二十、三十...一百、二百...一千、一千零一等
 * 
 * @param chineseNum - 中文數字文字
 * @returns 對應的阿拉伯數字，如果無法轉換則返回原文字
 */
function convertChineseNumberToArabic(chineseNum: string): string {
  // 基本數字映射
  const digits: Record<string, number> = {
    '零': 0, '〇': 0,
    '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  };
  
  const units: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000, '萬': 10000,
  };

  // 如果已經是數字，直接返回
  if (/^\d+$/.test(chineseNum)) {
    return chineseNum;
  }

  // 處理簡單的個位數（一到九）
  if (chineseNum.length === 1 && digits[chineseNum] !== undefined) {
    return digits[chineseNum].toString();
  }

  let result = 0;
  let temp = 0;
  let lastUnit = 1;

  for (let i = 0; i < chineseNum.length; i++) {
    const char = chineseNum[i];
    
    if (digits[char] !== undefined) {
      // 遇到數字
      if (digits[char] === 0) {
        // 遇到零，跳過（但記錄狀態）
        continue;
      }
      temp = digits[char];
    } else if (units[char] !== undefined) {
      // 遇到單位（十、百、千、萬）
      const unitValue = units[char];
      
      if (temp === 0) {
        // 單位前沒有數字，表示 1 個單位（例如「十」= 10）
        temp = 1;
      }
      
      if (unitValue >= lastUnit) {
        // 遇到更大的單位，先計算之前的部分
        result = (result + temp) * unitValue;
      } else {
        // 遇到更小的單位，直接加上
        result += temp * unitValue;
      }
      
      lastUnit = unitValue;
      temp = 0;
    } else {
      // 無法識別的字元，可能是其他文字，返回原文字
      return chineseNum;
    }
  }

  // 加上最後的個位數
  result += temp;

  // 如果轉換失敗（result === 0 且原文字不為零），返回原文字
  if (result === 0 && !chineseNum.includes('零') && !chineseNum.includes('〇')) {
    return chineseNum;
  }

  return result.toString();
}

/**
 * 增強查詢文本，提高向量搜尋的匹配率
 * 
 * @param query - 原始查詢文字
 * @returns 增強後的查詢文字
 */
export function enhanceQuery(query: string): string {
  let enhanced = query.trim();

  // 使用正則表達式匹配中文數字模式
  // 匹配：第X集、第X、X集 等格式（X 為中文數字）
  
  // 先匹配「第X集」、「第X」等模式
  enhanced = enhanced.replace(/第([零一二三四五六七八九十百千萬]+)(集)?/g, (match, chineseNum, suffix) => {
    const arabicNum = convertChineseNumberToArabic(chineseNum);
    return `第${arabicNum}${suffix || ''}`;
  });

  // 然後匹配獨立的「X集」（X 為中文數字），但要避免重複處理已經轉換過的
  enhanced = enhanced.replace(/([^第]|^)([零一二三四五六七八九十百千萬]+)集/g, (match, before, chineseNum) => {
    // 檢查是否已經是阿拉伯數字（避免重複轉換）
    if (!/^\d+$/.test(chineseNum)) {
      const arabicNum = convertChineseNumberToArabic(chineseNum);
      return `${before}${arabicNum}集`;
    }
    return match;
  });

  // 為查詢添加上下文提示（幫助 embedding 理解這是關於播客集數的查詢）
  if (/\d+\s*集/.test(enhanced) || /第\s*\d+/.test(enhanced)) {
    enhanced = `播客節目 ${enhanced} BNI官方播客`;
  }

  // 合併原始查詢和增強查詢，增加匹配機會
  // 使用 "OR" 邏輯的概念，但實際上是通過增強文本來實現
  return `${query} ${enhanced}`.trim();
}

