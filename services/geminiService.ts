
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData, Tenant } from "../types";
import { isWithinInterval, addDays, subDays, parseISO, startOfDay } from "date-fns";

// 캐시 및 상태 관리
const weatherCache = new Map<string, WeatherData>();
const pendingRequests = new Map<string, Promise<WeatherData | null>>();
const QUOTA_BLOCK_KEY = "gemini_api_quota_blocked_until";
const QUOTA_RESET_TIME = 1000 * 60 * 60; // 1시간 차단

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
    condition = "흐림(한파)"; tempCurrent = -2 + (day % 5); tempMin = -8; tempMax = 4; icon = "cloud";
  } else if (month >= 6 && month <= 8) {
    condition = "무더움"; tempCurrent = 28 + (day % 4); tempMin = 22; tempMax = 34; icon = "sun";
  } else if (month >= 3 && month <= 5) {
    condition = "포근함"; tempCurrent = 14 + (day % 6); tempMin = 6; tempMax = 21; icon = "sun";
  } else {
    condition = "선선함"; tempCurrent = 12 + (day % 5); tempMin = 5; tempMax = 18; icon = "sun";
  }

  return { condition, tempCurrent, tempMin, tempMax, icon };
};

/**
 * 날씨 정보를 가져오는 함수
 */
export const fetchWeatherInfo = async (dateStr: string, force: boolean = false, time: string = "09:00"): Promise<WeatherData | null> => {
  const now = Date.now();
  const targetDate = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  
  const storageKey = `weather_v6_${dateStr}_${time.replace(':', '')}`;

  const isNearToday = isWithinInterval(targetDate, {
    start: subDays(today, 14),
    end: addDays(today, 14)
  });

  if (!isNearToday) return getSeasonalMockWeather(dateStr);

  const blockedUntil = localStorage.getItem(QUOTA_BLOCK_KEY);
  if (blockedUntil && parseInt(blockedUntil) > now && !force) return getSeasonalMockWeather(dateStr);

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
      // Use process.env.API_KEY as per Google GenAI SDK guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });
      // 구체화된 검색 명령 프롬프트 적용
      const prompt = `네이버 날씨 정보를 검색해서 그 수치를 알려줘. 서울 ${dateStr} ${time} 기준 날씨 정보를 정확히 제공해줘. 
      결과 데이터 중 "condition" 필드는 반드시 한글 텍스트(예: 맑음, 흐림)여야 합니다. JSON 형식으로 반환하세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }], // 검색 그라운딩 도구 사용
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
        }
      });

      const weatherData = JSON.parse(response.text || '{}') as WeatherData;
      
      // 검색 출처 URL 추출 (그라운딩 메타데이터 활용)
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
        const source = groundingChunks[0].web;
        if (source) {
          weatherData.sourceUrl = source.uri;
          weatherData.sourceTitle = source.title;
        }
      }

      if (!weatherData.condition) return getSeasonalMockWeather(dateStr);

      weatherCache.set(storageKey, weatherData);
      try { localStorage.setItem(storageKey, JSON.stringify(weatherData)); } catch (e) {}
      return weatherData;

    } catch (error: any) {
      if (error && error.status === 429) {
        localStorage.setItem(QUOTA_BLOCK_KEY, (Date.now() + QUOTA_RESET_TIME).toString());
      }
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
    // Use process.env.API_KEY as per Google GenAI SDK guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });
    
    // 입주사 명단을 텍스트로 변환하여 프롬프트에 포함 (매칭 정확도 향상)
    const tenantContext = tenants.map(t => `${t.floor}: ${t.name}`).join(', ');

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image.split(',')[1], // Remove data URL prefix
      },
    };

    const prompt = `
      당신은 시설관리 전문가입니다. 제공된 계량기 사진을 분석하여 다음 정보를 추출하세요.
      
      1. 입주사 매칭: 사진의 라벨(견출지 등)에 적힌 층과 이름을 확인하세요.
         - 제공된 입주사 명단: [${tenantContext}]
         - 줄임말 대응: '이가종합건축사'는 '이가종합'으로 적혀있을 수 있습니다. 명단에서 가장 유사한 업체를 고르세요.
         - 층 표기 대응: '1층'은 '1F'와 동일합니다.
      2. 계량기 구분: 사진 속 라벨이나 문구(에어컨, 전열, 특수 등)를 통해 '일반'인지 '특수'인지 판단하세요. 명확하지 않으면 '일반'으로 분류하세요.
      3. 당월 지침값: 계량기의 숫자(디지털 또는 아날로그 다이얼)를 정확히 읽으세요. 소수점은 무시하고 정수 위주로 읽으세요.
      
      반드시 다음 JSON 형식으로 응답하세요:
      {
        "tenantName": "명단에 있는 정확한 입주사명",
        "floor": "명단에 있는 정확한 층",
        "type": "일반" 또는 "특수",
        "reading": "숫자로 된 지침값"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Meter analysis error:", error);
    return null;
  }
};
