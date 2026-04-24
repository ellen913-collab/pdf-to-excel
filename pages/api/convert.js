export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pdfBase64, userPrompt } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: '缺少 PDF 資料' });

  const systemPrompt = `你是一個專業的 PDF 表格擷取助手。請仔細分析 PDF 中的所有表格資料，以 JSON 格式回傳。

回傳格式：
{
  "sheets": [
    {
      "name": "工作表名稱",
      "headers": ["欄位1", "欄位2"],
      "rows": [["值1", "值2"]]
    }
  ]
}

規則：
- 多個表格各建一個 sheet
- 保留原始資料完整性，金額只保留數字
- 找不到表格時回傳 {"sheets": [], "message": "找不到表格資料"}
- 只回傳 JSON，不要有其他文字`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: userPrompt ? `請擷取此 PDF 中的所有表格資料。補充說明：${userPrompt}` : '請擷取此 PDF 中的所有表格資料。' }
          ]
        }]
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API 錯誤');

    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
