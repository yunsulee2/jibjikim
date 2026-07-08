// 집집 AI 챗봇 — Google Gemini 무료 티어 사용 (Vercel Serverless Function)
// GEMINI_API_KEY 환경변수가 없으면 503을 반환하고, 프론트가 규칙 기반 답변으로 폴백한다.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no_api_key' });

  const { messages = [], context = '', image = null } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'bad_request' });

  const system = `너는 '집집'의 AI 부동산 계약 비서다. 한국의 주택 임대차(전세·월세) 제도 전문가로서,
부동산 지식이 없는 사회초년생에게 친절한 존댓말로 답한다.

규칙:
- 등기부등본, 근저당, 확정일자, 전입신고, 대항력, 우선변제권, 전세보증보험(HUG/HF/SGI), 특약, 전세사기 예방, 청년 주거지원 제도가 주 전문 분야다.
- 딱딱한 안내문이 아니라 옆에서 도와주는 친구처럼 자연스럽게 대화한다. 인사·감사·잡담에도 사람처럼 반응한 뒤 필요한 정보를 잇는다.
- 사용자가 불안해하면 먼저 안심시키고, 모르는 용어는 비유로 쉽게 풀어준다. 이전 대화 맥락을 이어서 답한다.
- 답변은 3~7문장, 핵심 먼저. 목록이 필요하면 · 기호를 쓴다. 마크다운 문법(**, ## 등)은 절대 쓰지 않는다.
- 아래 [사용자 상황]이 있으면 반드시 그 수치와 상황을 인용해 맞춤으로 답한다. 다만 상황에만 갇히지 말고, 일반적인 질문에도 폭넓게 답한다.
- 사진(등기부등본·계약서 등)이 첨부되면 문서 종류를 먼저 밝히고, 소유자·근저당(채권최고액)·압류·전세권·특약 등 위험과 직결되는 내용을 읽어 짚어준다. 글자가 흐려 확실하지 않은 값은 추측하지 말고 "잘 안 보인다"고 말한다.
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

  // 사진 첨부(등기부등본·계약서) — 마지막 사용자 메시지에 이미지를 붙인다
  if (image && image.data && contents.length) {
    const mime = /^image\/(jpeg|png|webp)$/.test(image.mime) ? image.mime : 'image/jpeg';
    contents[contents.length - 1].parts.push({
      inline_data: { mime_type: mime, data: String(image.data).slice(0, 4_000_000) },
    });
  }

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
