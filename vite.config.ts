
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // GitHub Actions의 빌드 환경 변수 API_KEY를 소스 코드의 process.env.API_KEY로 매핑합니다.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
});
