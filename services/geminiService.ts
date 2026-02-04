
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
 * 할당량 초과 오류 시 재시도를 지원하는 유틸리티 함수
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 1, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
    if (retries > 0 && isQuotaError) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * 날씨 정보를 가져오는 함수
 */
export const fetchWeatherInfo = async (dateStr: string, force: boolean = false, time: string = "09:00"): Promise<WeatherData | null> => {
  const targetDate = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  const storageKey = `weather_gemini_v1_${dateStr}`;

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
      return await withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `오늘(${dateStr}) 서울 대치동 날씨를 검색해서 JSON으로 알려줘. (condition, tempCurrent, tempMin, tempMax, icon:"sun"|"cloud"...)`,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          },
        });

        const weatherData = JSON.parse(response.text || '{}');
        weatherCache.set(storageKey, weatherData);
        try { localStorage.setItem(storageKey, JSON.stringify(weatherData)); } catch (e) {}
        return weatherData;
      });
    } catch (error) {
      console.warn("Weather API limit reached, using seasonal defaults.");
      return getSeasonalMockWeather(dateStr);
    } finally {
      pendingRequests.delete(storageKey);
    }
  })();

  pendingRequests.set(storageKey, fetchPromise);
  return fetchPromise;
};

/**
 * 계량기 사진 분석 함수
 */
export const analyzeMeterPhoto = async (base64Image: string, tenants: Tenant[]): Promise<{
  tenantName: string;
  floor: string;
  type: '일반' | '특수';
  reading: string;
} | null> => {
  try {
    return await withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const tenantContext = tenants.map(t => `${t.floor}: ${t.name}`).join(', ');

      const imagePart = {
        inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] }
      };

      const prompt = `사진의 계량기 수치를 읽으세요. 입주사 명단 [${tenantContext}] 중 매칭되는 곳과 지침값(정수)을 JSON으로 반환하세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json" }
      });

      return JSON.parse(response.text || '{}');
    });
  } catch (error: any) {
    if (error?.message?.includes("429")) {
      alert("현재 AI 분석 서버가 혼잡합니다. 잠시 후 다시 시도하거나 지침값을 직접 입력해 주세요.");
    }
    return null;
  }
};
