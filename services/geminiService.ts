
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData } from "../types";
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
 * @param time 기준 시간 (기본값 09:00)
 */
export const fetchWeatherInfo = async (dateStr: string, force: boolean = false, time: string = "09:00"): Promise<WeatherData | null> => {
  const now = Date.now();
  const targetDate = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  
  // 저장 키를 날짜와 시간별로 관리
  const storageKey = `weather_v5_${dateStr}_${time.replace(':', '')}`;

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
      const apiKey = process.env.API_KEY;
      if (!apiKey) return getSeasonalMockWeather(dateStr);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Provide the weather for Seoul, South Korea on ${dateStr} at exactly ${time}. 
      The "condition" field MUST be in Korean language (text only, no emoji). Return JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
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
