
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData, Tenant } from "../types";
import { isWithinInterval, addDays, subDays, parseISO, startOfDay, format } from "date-fns";

// 캐시 및 상태 관리
const weatherCache = new Map<string, WeatherData>();
const pendingRequests = new Map<string, Promise<WeatherData | null>>();

const getSeasonalMockWeather = (dateStr: string): WeatherData => {
  const date = parseISO(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  let condition = "맑음";
  let tempCurrent = 15;
  let tempMin = 10;
  let tempMax = 20;
  let icon = "sun";

  if (month >= 12 || month <= 2) {
    condition = "흐림"; tempCurrent = -2 + (day % 5); tempMin = -1; tempMax = 7; icon = "cloud";
  } else if (month >= 6 && month <= 8) {
    condition = "맑음"; tempCurrent = 28 + (day % 4); tempMin = 22; tempMax = 34; icon = "sun";
  } else if (month >= 3 && month <= 5) {
    condition = "맑음"; tempCurrent = 14 + (day % 6); tempMin = 6; tempMax = 21; icon = "sun";
  } else {
    condition = "맑음"; tempCurrent = 12 + (day % 5); tempMin = 5; tempMax = 18; icon = "sun";
  }

  return { condition, tempCurrent, tempMin, tempMax, icon };
};

/**
 * 날씨 정보를 가져오는 함수 (Google Gemini API - Search Grounding 사용)
 */
export const fetchWeatherInfo = async (dateStr: string, force: boolean = false, time: string = "09:00"): Promise<WeatherData | null> => {
  const targetDate = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  
  const storageKey = `weather_gemini_v1_${dateStr}`;

  // 과거 데이터나 너무 먼 미래 데이터는 검색 효율이 떨어지므로 계절별 모의 데이터 반환
  const isNearToday = isWithinInterval(targetDate, {
    start: subDays(today, 1),
    end: addDays(today, 3)
  });

  if (!isNearToday) return getSeasonalMockWeather(dateStr);

  if (!force) {
    if (weatherCache.has(storageKey)) return weatherCache.get(storageKey) || null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        weatherCache.set(storageKey, parsed);
        return parsed;
      }
    } catch (e) {}
  }

  if (pendingRequests.has(storageKey)) return pendingRequests.get(storageKey)!;

  const fetchPromise = (async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        오늘(${dateStr}) 서울 강남구 대치동의 '네이버 날씨' 정보를 검색해서 알려줘.
        응답은 반드시 아래 JSON 형식을 지켜야 해:
        {
          "condition": "맑음/흐림/비/눈/구름많음 등",
          "tempCurrent": 현재온도(숫자),
          "tempMin": 최저온도(숫자),
          "tempMax": 최고온도(숫자),
          "icon": "sun" | "cloud" | "cloud-rain" | "cloud-snow" | "cloud-sun" | "wind" 중 하나 선택
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              condition: { type: Type.STRING },
              tempCurrent: { type: Type.NUMBER },
              tempMin: { type: Type.NUMBER },
              tempMax: { type: Type.NUMBER },
              icon: { type: Type.STRING }
            },
            required: ["condition", "tempCurrent", "tempMin", "tempMax", "icon"]
          }
        },
      });

      const weatherResult = JSON.parse(response.text || '{}');
      
      // 검색 출처 URL 추출 (Search Grounding 필수 규칙)
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sourceUrl = groundingChunks?.[0]?.web?.uri || "https://weather.naver.com";

      const weatherData: WeatherData = {
        ...weatherResult,
        sourceUrl: sourceUrl,
        sourceTitle: "네이버 날씨 (Gemini 검색)"
      };

      weatherCache.set(storageKey, weatherData);
      try { localStorage.setItem(storageKey, JSON.stringify(weatherData)); } catch (e) {}
      return weatherData;

    } catch (error) {
      console.error("Gemini Weather Error:", error);
      return getSeasonalMockWeather(dateStr);
    } finally {
      pendingRequests.delete(storageKey);
    }
  })();

  pendingRequests.set(storageKey, fetchPromise);
  return fetchPromise;
};

/**
 * 계량기 사진을 분석하여 입주사 및 지침값을 추출하는 함수
 */
export const analyzeMeterPhoto = async (base64Image: string, tenants: Tenant[]): Promise<{
  tenantName: string;
  floor: string;
  type: '일반' | '특수';
  reading: string;
} | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const tenantContext = tenants.map(t => `${t.floor}: ${t.name}`).join(', ');

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image.split(',')[1],
      },
    };

    const prompt = `
      제공된 계량기 사진을 분석하세요.
      1. 입주사 매칭: [${tenantContext}] 명단에서 사진의 층/이름과 가장 유사한 업체를 고르세요.
      2. 계량기 구분: '일반' 또는 '특수'(에어컨/전열 등)로 분류하세요.
      3. 지침값: 계량기의 숫자를 정확히 읽으세요.
      
      반드시 다음 JSON 형식으로 응답하세요:
      {
        "tenantName": "업체명",
        "floor": "층",
        "type": "일반" 또는 "특수",
        "reading": "숫자"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Meter analysis error:", error);
    return null;
  }
};
