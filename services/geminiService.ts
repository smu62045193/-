
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

  if (!isNearToday || !force) return getSeasonalMockWeather(dateStr);

  if (weatherCache.has(storageKey)) return weatherCache.get(storageKey) || null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      weatherCache.set(storageKey, parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('localStorage getItem error:', e);
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
        try { localStorage.setItem(storageKey, JSON.stringify(weatherData)); } catch (e) {
          console.error('localStorage setItem error:', e);
        }
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
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        console.warn("Gemini API key is missing");
        return null;
      }
      const ai = new GoogleGenAI({ apiKey });
      const tenantContext = tenants.map(t => `${t.floor}: ${t.name}`).join(', ');

      const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      const imagePart = {
        inlineData: { mimeType: 'image/jpeg', data: base64Data }
      };

      const prompt = `이 사진은 계량기(전력량계) 사진입니다. 사진을 정밀 분석하여 아래 4가지 항목을 정확하게 추출한 후 JSON으로 출력하세요.

1. 노란색 스티커/라벨 표지판 분석 (가장 중요):
   - 계량기 전면이나 상단에 부착된 노란색 라벨/테이프를 유심히 찾으세요. (예: [B2F] [특수] 식당, [2F] [일반] 이가종합, [3F] [특수] 이가ACM, [5F] [일반] 이스턴)
   - [층수]: B2F, 2F, 3F, 4F, 5F, B1 등 층수를 floor 항목으로 추출하세요.
   - [구분]: '일반' 또는 '특수'를 type 항목으로 추출하세요.
   - [입주사명]: 스티커에 표기된 입주사명(예: 식당, 이가종합, 이가ACM, 이스턴 등)을 tenantName 항목으로 추출하세요.
   - 노란색 스티커가 없다면 주변의 인쇄된 라벨이나 명표를 참조하세요.

2. 계량기 수치 (지침값):
   - 계량기 중앙의 LCD 디지털 화면에 표시된 계량 수치 숫자를 읽으세요. (예: 33663.0, 37722.1, 09391.8, 16276.2 등)
   - 소수점을 제외한 정수 부분(예: 33663)을 reading 항목으로 추출하세요.

등록된 입주사 명단 목록: [${tenantContext}]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tenantName: { type: Type.STRING, description: "노란색 라벨/명표의 입주사 명칭" },
              floor: { type: Type.STRING, description: "층수 (예: B2F, 2F, 3F)" },
              type: { type: Type.STRING, enum: ["일반", "특수"], description: "검침 구분 (일반 또는 특수)" },
              reading: { type: Type.STRING, description: "계량기 검침 수치 정수 (예: 33663)" }
            },
            required: ["tenantName", "floor", "type", "reading"]
          }
        }
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);

      const tenantName = (parsed.tenantName || parsed.tenant || parsed.tenant_name || '').trim();
      const floor = (parsed.floor || parsed.floorName || '').trim();
      const type = parsed.type === '특수' ? '특수' : '일반';

      let rawReading = parsed.reading ?? parsed.currentReading ?? parsed.value ?? '';
      if (typeof rawReading === 'number') {
        rawReading = String(Math.floor(rawReading));
      } else {
        const strVal = String(rawReading).trim();
        const match = strVal.match(/\d+(\.\d+)?/);
        if (match) {
          rawReading = String(Math.floor(parseFloat(match[0])));
        } else {
          rawReading = strVal.replace(/[^0-9]/g, '');
        }
      }
      const reading = rawReading;

      return { tenantName, floor, type, reading };
    });
  } catch (error: any) {
    console.error("analyzeMeterPhoto error:", error);
    if (error?.message?.includes("429")) {
      alert("현재 AI 분석 서버가 혼잡합니다. 잠시 후 다시 시도하거나 지침값을 직접 입력해 주세요.");
    }
    return null;
  }
};
