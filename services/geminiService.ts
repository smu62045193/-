
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData, Tenant } from "../types";
import { isWithinInterval, addDays, subDays, parseISO, startOfDay } from "date-fns";

// 캐시 및 상태 관리
const weatherCache = new Map<string, WeatherData>();
const pendingRequests = new Map<string, Promise<WeatherData | null>>();

// 기상청 API 키 (사용자 제공)
const KMA_API_KEY = "ee091b24333b8a98fef62d62d6208aff0713004c9702eeee542de1c4b3618138";

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
 * 날씨 정보를 가져오는 함수 (기상청 API 사용)
 */
export const fetchWeatherInfo = async (dateStr: string, force: boolean = false, time: string = "09:00"): Promise<WeatherData | null> => {
  const targetDate = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  
  const storageKey = `weather_v9_${dateStr}_${time.replace(':', '')}`;

  // 기상청 단기예보 특성상 현재 기준 ±3일 이내만 실시간 조회 시도
  const isNearToday = isWithinInterval(targetDate, {
    start: subDays(today, 3),
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
      // 기상청 단기예보 API 호출 (대치동 좌표: nx=61, ny=125)
      const baseDate = dateStr.replace(/-/g, '');
      const baseTime = "0500"; // 05시 발표 데이터 기준
      
      // API 키 인코딩 처리 (일부 키는 특수문자 포함 시 인코딩 필요할 수 있음)
      const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(KMA_API_KEY)}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=61&ny=125`;

      const response = await fetch(url);
      
      // 응답 상태 확인 (Unauthorized 등의 에러 처리)
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Weather API Error (${response.status}):`, errorText);
        return getSeasonalMockWeather(dateStr);
      }

      // Content-Type 확인
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.warn("Weather API returned non-JSON response:", text);
        return getSeasonalMockWeather(dateStr);
      }

      const json = await response.json();

      if (json.response?.header?.resultCode !== "00") {
        console.warn("KMA API response error:", json.response?.header?.resultMsg);
        return getSeasonalMockWeather(dateStr);
      }

      const items = json.response.body.items.item;
      let tempMin = 0, tempMax = 0, sky = "1", pty = "0", tempCur = 0;
      
      items.forEach((item: any) => {
        if (item.category === "TMN") tempMin = Math.round(parseFloat(item.fcstValue));
        if (item.category === "TMX") tempMax = Math.round(parseFloat(item.fcstValue));
        if (item.category === "SKY") sky = item.fcstValue;
        if (item.category === "PTY") pty = item.fcstValue;
        if (item.category === "TMP" && item.fcstTime === "0900") tempCur = Math.round(parseFloat(item.fcstValue));
      });

      let condition = "맑음";
      let icon = "sun";

      if (pty !== "0") {
        condition = pty === "1" ? "비" : pty === "2" ? "비/눈" : pty === "3" ? "눈" : "소나기";
        icon = "cloud-rain";
      } else {
        if (sky === "1") { condition = "맑음"; icon = "sun"; }
        else if (sky === "3") { condition = "구름많음"; icon = "cloud-sun"; }
        else if (sky === "4") { condition = "흐림"; icon = "cloud"; }
      }

      const weatherData: WeatherData = {
        condition,
        tempCurrent: tempCur || Math.round((tempMin + tempMax) / 2),
        tempMin: tempMin || -2,
        tempMax: tempMax || 7,
        icon,
        sourceUrl: "https://www.weather.go.kr",
        sourceTitle: "기상청 단기예보"
      };

      weatherCache.set(storageKey, weatherData);
      try { localStorage.setItem(storageKey, JSON.stringify(weatherData)); } catch (e) {}
      return weatherData;

    } catch (error) {
      console.error("Weather API fetch failed:", error);
      return getSeasonalMockWeather(dateStr);
    } finally {
      pendingRequests.delete(storageKey);
    }
  })();

  pendingRequests.set(storageKey, fetchPromise);
  return fetchPromise;
};

/**
 * 계량기 사진을 분석하여 입주사 및 지침값을 추출하는 함수 (최신 gemini-3-flash-preview 사용)
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
