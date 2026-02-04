
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
 * 날씨 정보를 가져오는 함수
 */
export const fetchWeatherInfo = async (dateStr: string, force: boolean = false, time: string = "09:00"): Promise<WeatherData | null> => {
  const now = Date.now();
  const targetDate = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  
  const storageKey = `weather_v7_${dateStr}_${time.replace(':', '')}`;

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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const prompt = `네이버 날씨 정보를 검색해서 서울 지역의 ${dateStr} ${time} 기준 날씨와 최저/최고 온도를 알려줘. 
      결과 데이터 중 "condition" 필드는 반드시 한글 텍스트(예: 맑음, 흐림)여야 합니다. 
      반드시 아래와 같은 순수한 JSON 형식으로만 응답하세요:
      {
        "condition": "맑음",
        "tempCurrent": 15,
        "tempMin": 10,
        "tempMax": 20,
        "icon": "sun"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          // Fixed: googleSearch 사용 시 responseMimeType 및 responseSchema는 400에러를 유발하므로 제거함
        }
      });

      const responseText = response.text || "";
      // 텍스트 응답 내에서 JSON 블록만 추출하는 로직 추가
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      let weatherData: WeatherData;
      try {
        weatherData = JSON.parse(jsonStr) as WeatherData;
      } catch (parseErr) {
        console.warn("JSON parsing failed, using fallback", parseErr);
        return getSeasonalMockWeather(dateStr);
      }

      // Grounding 정보 추출 (필수 요구사항)
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
        const firstWebChunk = groundingChunks.find(chunk => chunk.web);
        if (firstWebChunk && firstWebChunk.web) {
          weatherData.sourceUrl = firstWebChunk.web.uri;
          weatherData.sourceTitle = firstWebChunk.web.title;
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Meter analysis error:", error);
    return null;
  }
};
