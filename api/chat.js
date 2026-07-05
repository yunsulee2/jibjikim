// 집지킴 AI 챗봇 — Google Gemini 무료 티어 사용 (Vercel Serverless Function)
// GEMINI_API_KEY 환경변수가 없으면 503을 반환하고, 프론트가 규칙 기반 답변으로 폴백한다.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no_api_key' });

  const { messages = [], context = '' } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'bad_request' });

  const system = `너는 '집지킴'의 AI 부동산 계약 비서다. 한국의 주택 임대차(전세·월세) 제도 전문가로서,
부동산 지식이 없는 사회초년생에게 친절한 존댓말로 답한다.

규칙:
- 등기부등본, 근저당, 확정일자, 전입신고, 대항력, 우선변제권, 전세보증보험(HUG/HF/SGI), 특약, 전세사기 예방, 청년 주거지원 제도가 주 전문 분야다.
- 답변은 3~7문장, 핵심 먼저. 목록이 필요하면 · 기호를 쓴다. 마크다운 문법(**, ## 등)은 절대 쓰지 않는다.
- 아래 [사용자 상황]이 있으면 반드시 그 수치와 상황을 인용해 맞춤으로 답한다.
- 특약 문구를 요청받으면 계약서에 바로 쓸 수 있는 완성 문장을 큰따옴표로 제시한다.
- 확실하지 않은 법률·세부 요건은 단정하지 말고 관련 기관(주민센터, HUG, 인터넷등기소, 정부24) 확인을 권한다.
- 부동산과 무관한 질문에는 "계약과 주거 관련 질문을 도와드리는 비서"라고 부드럽게 안내한다.
- 중요한 결정 앞에서는 전문가(공인중개사·법률구조공단) 상담도 함께 권한다.

[사용자 상황]
${String(context).slice(0, 2000)}`;

  const contents = messages.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.text || '').slice(0, 2000) }],
  }));

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
        }),
      }
    );
    if (!r.ok) return res.status(502).json({ error: 'upstream', status: r.status });
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
    if (!text) return res.status(502).json({ error: 'empty' });
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'fetch_fail' });
  }
}
