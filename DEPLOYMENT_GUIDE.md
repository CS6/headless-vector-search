# 部署說明指南

## 📋 架構概覽

這個專案包含 **三個主要部分**，它們部署在不同的地方：

```
┌─────────────────────────────────────────────────────────────┐
│  1. 後端服務（這個 repo - headless-vector-search）          │
│     ✅ 已部署在 Supabase                                    │
│     - Edge Function (vector-search)                         │
│     - 資料庫 schema 和函數                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓ API 呼叫
┌─────────────────────────────────────────────────────────────┐
│  2. 前端搜尋介面（你的文檔網站）                            │
│     ⚠️ 需要你自行部署在你的文檔網站中                       │
│     - HTML/React/Vue/Next.js 等前端應用                     │
│     - 用戶看到和互動的搜尋介面                              │
└─────────────────────────────────────────────────────────────┘
                            ↓ 資料來源
┌─────────────────────────────────────────────────────────────┐
│  3. 文檔內容（你的文檔 repo）                               │
│     ✅ 透過 GitHub Actions 匯入到資料庫                     │
│     - Markdown 檔案                                         │
│     - GitHub Action 自動生成 embeddings                     │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 重點：前端搜尋介面程式碼部署在哪裡？

### ❌ **不是**部署在這裡：
- ❌ 不是在這個 `headless-vector-search` repo
- ❌ 不是在 Supabase（Supabase 只負責後端 Edge Function）
- ❌ 不是單獨的服務器

### ✅ **是**部署在你的文檔網站中：

前端搜尋介面程式碼應該整合到你**實際展示文檔給用戶的前端應用**中，例如：

1. **如果你的文檔是用 Next.js 建立**：
   - 程式碼放在 Next.js 專案的組件中
   - 例如：`components/SearchDialog.tsx`

2. **如果你的文檔是用 Vue 建立**：
   - 程式碼放在 Vue 專案的組件中
   - 例如：`components/SearchModal.vue`

3. **如果你的文檔是用純 HTML/JavaScript**：
   - 程式碼放在 HTML 檔案中
   - 例如：`search.html` 或嵌入到現有的頁面

4. **如果你的文檔是用其他框架**（React, Svelte, Angular 等）：
   - 整合到該框架的組件中

## 📝 具體實作步驟

### 步驟 1：確認後端已部署（這個 repo）

```bash
# 1. 部署 Edge Function 到 Supabase
supabase functions deploy vector-search --no-verify-jwt

# 2. 確認 Edge Function URL
# 在 Supabase Dashboard > Functions 找到你的 URL
# 例如：https://your-project.supabase.co/functions/v1/vector-search
```

### 步驟 2：在你的文檔網站中添加前端搜尋介面

**範例：整合到 Next.js 文檔網站**

```typescript
// components/SearchDialog.tsx (在你的 Next.js 專案中)
'use client'

import { useState } from 'react'

export function SearchDialog() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnswer('')
    setLoading(true)

    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const functionUrl = `${projectUrl}/functions/v1/vector-search`
    const url = `${functionUrl}?${new URLSearchParams({ query })}`

    try {
      const response = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        }
      })

      // 處理 SSE 串流...
      // (使用之前提供的 fetch API 程式碼)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSearch}>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋文檔..."
      />
      <button type="submit">搜尋</button>
      {answer && <div>{answer}</div>}
    </form>
  )
}
```

**範例：整合到 Vue 文檔網站**

```vue
<!-- components/SearchModal.vue (在你的 Vue 專案中) -->
<template>
  <div class="search-modal">
    <form @submit.prevent="handleSearch">
      <input 
        v-model="query" 
        placeholder="搜尋文檔..."
      />
      <button type="submit">搜尋</button>
    </form>
    <div v-if="loading">載入中...</div>
    <div v-else>{{ answer }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const query = ref('')
const answer = ref('')
const loading = ref(false)

const handleSearch = async () => {
  answer.value = ''
  loading.value = true

  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  const functionUrl = `${projectUrl}/functions/v1/vector-search`
  const url = `${functionUrl}?${new URLSearchParams({ query: query.value })}`

  // 使用 fetch API 處理 SSE...
  // (使用之前提供的程式碼)
}
</script>
```

## 🔍 關鍵理解

### 這個 repo (`headless-vector-search`) 是什麼？

這是一個 **「Headless」工具包**，意思是：
- ✅ 它提供**後端 API**（Edge Function）
- ✅ 它提供**資料庫結構**
- ❌ 它**不提供**現成的前端 UI
- ✅ 它讓你**自由選擇**任何前端框架來建立 UI

### 為什麼叫 "Headless"？

就像 "Headless CMS" 的概念：
- **Head（頭）= 前端介面**
- **Body（身體）= 後端 API**
- **Headless = 沒有固定前端，你可以自由選擇前端**

### 實際案例

看看 Supabase 官方文檔是怎麼做的：
- 後端：使用這個 `headless-vector-search` 提供的 Edge Function
- 前端：他們在自己的 Next.js 文檔網站中建立了搜尋介面
- 當用戶按下 `cmd+k`，就會呼叫後端的 Edge Function

## 📚 總結

1. **後端（這個 repo）**：已經部署 ✅
   - Edge Function 在 Supabase
   - 資料庫在 Supabase

2. **前端搜尋介面**：需要你自行建立和部署 ⚠️
   - 在你的文檔網站專案中
   - 可以是任何框架（React, Vue, Next.js 等）
   - 使用 `search-interface-example.html` 作為參考

3. **文檔內容**：透過 GitHub Actions 自動匯入 ✅
   - 在你的文檔 repo 中設定 GitHub Action
   - 自動將 Markdown 轉換為 embeddings

## 🚀 快速開始

如果你想先測試看看，可以直接：

1. 開啟 `search-interface-example.html` 檔案
2. 在瀏覽器中打開
3. 填入你的 Supabase 專案 URL
4. 測試搜尋功能

這個 HTML 檔案是獨立的測試頁面，你可以：
- 用它來測試 Edge Function 是否正常工作
- 參考它的程式碼來整合到你的實際應用中
- 根據你的需求修改樣式和功能

