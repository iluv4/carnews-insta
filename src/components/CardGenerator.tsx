'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './CardGenerator.module.css';
import TemplateCard from './TemplateCard';
import { useSession, signIn } from 'next-auth/react';
import { useTab } from '@/context/TabContext';
import PortalDashboard from './PortalDashboard';


interface Template {
  id: string;
  name: string;
  content: string;
  thumbnail?: string;
  source?: string;
  category?: string;
  tags?: string[];
  user?: { name: string; image: string };
}

const TEMPLATE_CATEGORIES = [
  { id: 'all',        label: '전체' },
  { id: '사진관/스튜디오', label: '📸 사진관' },
  { id: '보험/금융',    label: '🛡️ 보험/금융' },
  { id: '뷰티/코스메틱', label: '💄 뷰티' },
  { id: '음식점/카페',   label: '🍽️ 음식점' },
  { id: '교육/정보',    label: '📚 교육' },
  { id: '패션/라이프스타일', label: '👗 패션' },
  { id: 'SNS/마케팅',   label: '📱 마케팅' },
  { id: '기타',        label: '🗂️ 기타' },
];

const SOSOHAN_URL = 'https://www.instagram.com/sosohanpoonggyeong/';

function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').split('?')[0].toLowerCase();
}

// 클라이언트 포털 설정
// clientInstagramUrl: 해당 고객의 인스타 (내 사진 소스)
// styleReferenceUrl: 레이아웃/디자인 DNA 학습용 레퍼런스
// additionalReferenceUrls: 포털 로드 시 추가로 레퍼런스 이미지로 불러올 포스트 URL 목록
// clientContext: AI 생성 프롬프트에 주입할 업체/메뉴 정보
// slideCount: 생성할 슬라이드 수 (기본 3)
const CLIENT_PORTALS: Record<string, {
  name: string;
  icon: string;
  clientInstagramUrl: string;
  styleReferenceUrl: string;
  additionalReferenceUrls?: string[];
  clientContext?: string;
  slideCount?: number;
  naverPlaceQuery?: string;   // 네이버 지도 사진 크롤링용 검색어
  placeholder: string;
}> = {
  'portal-sosohan': {
    name: '소소한풍경',
    icon: '🍃',
    clientInstagramUrl: SOSOHAN_URL,
    styleReferenceUrl: 'https://www.instagram.com/p/DWiwH4cAbZP/',
    additionalReferenceUrls: [
      'https://www.instagram.com/p/DTCNeX0kqQR/',
      'https://www.instagram.com/p/DWdnskCgYpj/',
    ],
    clientContext: `
[업체 정보 - 소소한풍경]
업종: 퓨전 한정식 코스 레스토랑
위치: 서울 종로구 자하문로40길 75 (부암동 239-13)
전화: 02-395-5035
분위기: 가정집 개조, 아늑한 정원·야외테라스·개별룸 보유. 데이트·가족 식사 최적.

[영업시간 — 카드뉴스에 정확히 표기할 것]
화~토: 11:30 ~ 22:00
일요일: 11:30 ~ 21:30
월요일: 정기휴무
브레이크타임: 15:30 ~ 17:00
※ 브레이크타임 피해서 방문 권장 문구 필수 포함

[코스 메뉴 — 가격 그대로 표기]
A코스: 28,000원
B코스: 42,000원
C코스: 58,000원
Special코스: 120,000원

[단품 메뉴 — 가격 그대로 표기]
가지찜: 30,000원
건두부쌈: 22,000원
오징어먹물볶음밥: 16,000원
하우스 샐러드: 14,000원
버팔로 윙: 16,000원

[방문 팁 — 카드뉴스에 포함할 것]
- 브레이크타임(15:30~17:00) 피해서 방문
- 월요일 정기휴무 확인
- 방문 전 테이블링·캐치테이블 예약 권장
- 가격은 방문 전 매장 확인 권장 (2026년 5월 기준)
- 전화 예약: 02-395-5035

[6장 카드뉴스 구성]
1장(표지): "부암동 소소한풍경 방문 전 체크!" / 부제: 가격·시간·팁 한눈에
2장(운영시간): 화~토 11:30~22:00 / 일 11:30~21:30 / 월 휴무 / 브레이크 15:30~17:00
3장(코스 가격): A 28,000 / B 42,000 / C 58,000 / Special 120,000
4장(단품 가격): 가지찜 30,000 / 건두부쌈 22,000 / 오징어먹물볶음밥 16,000 / 샐러드 14,000 / 버팔로윙 16,000
5장(방문 팁): 브레이크타임 피하기 / 월요일 휴무 / 예약 권장 / 전화 02-395-5035
6장(CTA): "부암동 데이트·가족 식사 전 저장!" / "예약 전 운영시간 꼭 확인" / 하단 면책: 2026년 5월 기준

[브랜드 키워드]
소소함, 정갈함, 퓨전 한식, 부암동 감성, 코스 요리, 가정집 레스토랑
    `.trim(),
    slideCount: 6,
    naverPlaceQuery: '소소한풍경 부암동',
    placeholder: '소소한풍경 카드뉴스에 담을 내용을 입력하세요...',
  },
  'portal-insurance': {
    name: '보험 설계 프로',
    icon: '🛡️',
    clientInstagramUrl: '', // 고객 인스타 URL 연동 후 추가
    styleReferenceUrl: 'https://www.instagram.com/p/DXtZaX8EduP/',
    placeholder: '보험 상품의 핵심 혜택을 입력하세요...',
  },
  'portal-beauty': {
    name: '럭셔리 뷰티',
    icon: '💄',
    clientInstagramUrl: '', // 고객 인스타 URL 연동 후 추가
    styleReferenceUrl: 'https://www.instagram.com/p/DVFHGrakybK/',
    placeholder: '제품의 차별화 포인트를 입력하세요...',
  },
  'portal-studio': {
    name: '감성 스튜디오',
    icon: '📸',
    clientInstagramUrl: '', // 고객 인스타 URL 연동 후 추가
    styleReferenceUrl: 'https://www.instagram.com/p/DXTdPJvks-J/',
    placeholder: '스튜디오/사진관의 감성을 담은 문구를 입력하세요...',
  },
};

export default function CardGenerator() {
  const { data: session } = useSession();
  const { activeTab, setActiveTab } = useTab();

  // Navigation & Stepper State
  const [currentStep, setCurrentStep] = useState(0);

  // UI States
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Data States
  const [instagramUrl, setInstagramUrl] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [jsonlData, setJsonlData] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [theme, setTheme] = useState('');
  const [generationMode, setGenerationMode] = useState<'creative' | 'strict'>('creative');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [examplePreviews, setExamplePreviews] = useState<Record<string, string>>({});
  const [clientAnalysisCache, setClientAnalysisCache] = useState<Record<string, string>>({});
  // 스타일 레퍼런스 포스트의 실제 카드뉴스 이미지 (images.edit 템플릿으로 사용)
  const [styleTemplateBase64, setStyleTemplateBase64] = useState<string>('');

  const generatingStartRef = useRef<number>(0);

  const industryExamples = [
    { name: '식품', url: 'https://www.instagram.com/p/DWiwH4cAbZP/' },
  ];

  const loadingTips = [
    "Tip: 인스타그램 카드뉴스는 첫 장의 훅(Hook) 문구가 가장 중요합니다.",
    "Tip: 고대비 색상 조합은 가독성을 높여 이탈률을 줄여줍니다.",
    "Tip: 카드뉴스 본문은 1~2줄의 짧은 문장이 가장 잘 읽힙니다.",
    "Tip: 마지막 슬라이드에 명확한 CTA(Call to Action)를 넣어보세요.",
    "Tip: GPT-Image-2가 레퍼런스 스타일을 정밀 학습하는 중입니다...",
  ];

  useEffect(() => {
    fetchTemplates();
    fetchExamplePreviews();
  }, []);

  // 포털 탭 전환 시: 해당 클라이언트 사진 자동 로드 + 스타일 분석 자동 시작
  useEffect(() => {
    const portal = CLIENT_PORTALS[activeTab];
    if (!portal) return;

    setStatusText(`${portal.icon} ${portal.name} 포털 로딩 중...`);
    setReferenceImages([]);
    setJsonlData('');
    setCurrentStep(2);

    // 1) 프리셋 우선 로드 → 없으면 Instagram API fallback
    const portalId = activeTab.replace('portal-', '');
    const manifestUrl = `/presets/${portalId}/manifest.json`;

    fetch(manifestUrl)
      .then(r => r.ok ? r.json() : null)
      .then(async (manifest) => {
        if (manifest?.photos?.length > 0) {
          // ✅ 프리셋 있음 → 즉시 로드 (API 호출 없음)
          const settled = await Promise.allSettled(
            manifest.photos.slice(0, 12).map((path: string) =>
              imgUrlToBase64(path)
            )
          );
          const b64s = settled
            .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
            .map(r => r.value);
          if (b64s.length > 0) {
            setReferenceImages(b64s);
            setStatusText(`✅ ${portal.name} 프리셋 ${b64s.length}장 로드됨`);
            return;
          }
        }

        // ⚡ 프리셋 없음 → Instagram API fallback
        const urlsToLoad = [
          ...(portal.clientInstagramUrl ? [portal.clientInstagramUrl] : []),
          ...(portal.additionalReferenceUrls ?? []),
        ];
        if (urlsToLoad.length === 0) return;

        Promise.all(
          urlsToLoad.map(u =>
            fetch('/api/instagram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: u }),
            })
              .then(r => r.json())
              .then((data): string[] => data.images ?? [])
              .catch(() => [] as string[])
          )
        ).then(async (results) => {
          const allImageUrls = results.flat();
          if (allImageUrls.length === 0) return;
          const settled = await Promise.allSettled(allImageUrls.slice(0, 9).map(imgUrlToBase64));
          const b64s = settled
            .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
            .map(r => r.value);
          if (b64s.length > 0) {
            setReferenceImages(b64s);
            setStatusText(`✅ ${portal.name} 사진 ${b64s.length}장 로드 완료`);
          }
        });
      })
      .catch(console.error);

    // 2) 스타일 레퍼런스 분석 (캐시 우선)
    if (portal.styleReferenceUrl) {
      const cached = clientAnalysisCache[normaliseUrl(portal.styleReferenceUrl)];
      if (cached) {
        setJsonlData(cached);
        setInstagramUrl(portal.styleReferenceUrl);
      } else {
        setInstagramUrl(portal.styleReferenceUrl);
        // 비동기로 분석 실행
        handleOneClickAnalyze(portal.styleReferenceUrl);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (!generating) return;
    generatingStartRef.current = Date.now();
    setElapsedSeconds(0);
    setCurrentTipIndex(0);
    const tipT = setInterval(() => setCurrentTipIndex(i => (i + 1) % loadingTips.length), 3500);
    const elapsedT = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generatingStartRef.current) / 1000));
    }, 1000);
    return () => { clearInterval(tipT); clearInterval(elapsedT); };
  }, [generating]);


  const fetchExamplePreviews = async () => {
    const results = await Promise.allSettled(
      industryExamples.map(ex =>
        fetch('/api/instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ex.url }),
        })
          .then(r => r.json())
          .then(data => ({ url: ex.url, img: data.images?.[0] || null }))
      )
    );
    const previews: Record<string, string> = {};
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value.img) {
        previews[r.value.url] = r.value.img;
      }
    });
    setExamplePreviews(previews);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) { console.error(err); }
  };

  const handleFetchImages = async (urlToFetch?: string) => {
    const url = urlToFetch || instagramUrl;
    if (!url) return null;

    setLoading(true);
    setStatusText('인스타그램 미디어 추출 중...');

    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExtractedImages(data.images);
      setSelectedImageIndex(0);
      setStatusText(`${data.images.length}장 추출 완료!`);
      return data.images;
    } catch (error: any) {
      setStatusText(`Error: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const imgUrlToBase64 = (imgUrl: string): Promise<string> => {
    const isInstagramUrl = imgUrl.includes('instagram.com') || imgUrl.includes('cdninstagram.com');
    const proxyUrl = isInstagramUrl ? `/api/proxy?url=${encodeURIComponent(imgUrl)}` : imgUrl;

    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = proxyUrl;

      img.onload = () => {
        const MAX_SIZE = 1024;
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        fetch(`/api/proxy/base64?url=${encodeURIComponent(imgUrl)}`)
          .then(res => res.json())
          .then(data => data.base64 ? resolve(data.base64) : reject(new Error('이미지 로딩 최종 실패')))
          .catch(() => reject(new Error('이미지 로드에 최종 실패했습니다.')));
      };
    });
  };

  const handleAnalyze = async (specificImgs?: string[]) => {
    const imgList = specificImgs || extractedImages;
    if (!imgList || imgList.length === 0) return;

    setAnalyzing(true);
    setProgress(0);
    setStatusText('AI가 디자인 DNA 분석 중...');

    const statusRotation = ['브랜드 컬러 추출 중...', '타이포그래피 패턴 분석 중...', '레이아웃 에스테틱 동기화 중...', '시각적 계층 구조 학습 중...'];
    let statusIdx = 0;
    const statusInterval = setInterval(() => {
      setStatusText(statusRotation[statusIdx % statusRotation.length]);
      statusIdx++;
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + (100 - prev) * 0.1, 98));
    }, 400);

    try {
      setStatusText('레퍼런스 이미지 다운로드 중...');
      const settled = await Promise.allSettled(imgList.slice(0, 5).map(imgUrlToBase64));
      const base64Images = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);

      console.log(`[analyze] ${base64Images.length}/${Math.min(imgList.length, 5)} images converted`);

      if (base64Images.length === 0) {
        throw new Error('이미지를 로드할 수 없습니다. 다시 시도해주세요.');
      }

      setStatusText(`${base64Images.length}장 이미지 AI 분석 중...`);

      const cacheKey = instagramUrl || undefined;
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: base64Images, cacheKey }),
      });
      const data = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(data.error || '분석 오류');

      clearInterval(progressInterval);
      clearInterval(statusInterval);
      setProgress(100);
      setJsonlData(data.analysis);

      // Save to client-side analysis cache
      if (cacheKey) {
        setClientAnalysisCache(prev => ({ ...prev, [normaliseUrl(cacheKey)]: data.analysis }));
      }

      setStatusText(data.cached ? '✅ 캐시된 분석 결과 사용 (빠른 로드)' : '스타일 학습 완료!');
      return data.analysis;
    } catch (error: any) {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      console.error('[analyze error]', error);
      setStatusText(`분석 실패: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOneClickAnalyze = async (url: string) => {
    // Check client-side cache first — skip re-analysis if already done
    const cached = clientAnalysisCache[normaliseUrl(url)];
    if (cached) {
      setInstagramUrl(url);
      setJsonlData(cached);
      setCurrentStep(2);
      setStatusText('✅ 이미 분석된 스타일 — 바로 적용!');
      return;
    }

    setInstagramUrl(url);
    setJsonlData('');
    setCurrentStep(2);
    setAnalyzing(true);
    setStatusText('AI가 스타일을 실시간 학습 중입니다. 잠시만 기다려주세요...');

    try {
      const images = await handleFetchImages(url);
      if (images && images.length > 0) {
        setSelectedImageIndex(0);

        // 스타일 레퍼런스 첫 번째 이미지를 레이아웃 템플릿으로 저장
        imgUrlToBase64(images[0])
          .then(b64 => setStyleTemplateBase64(b64))
          .catch(() => {});

        const analysis = await handleAnalyze(images);
        if (analysis) {
          setStatusText('맞춤형 스타일 학습 완료! 내용을 입력하세요.');
        } else {
          throw new Error('디자인 분석에 실패했습니다.');
        }
      } else {
        throw new Error('인스타그램 미디어를 가져오지 못했습니다.');
      }
    } catch (err: any) {
      setStatusText(`오류: ${err.message}`);
      setCurrentStep(0);
    } finally {
      setAnalyzing(false);
    }
  };

  const autoDownload = async (url: string, filename: string) => {
    try {
      let href = url;
      if (!url.startsWith('data:')) {
        const isInstagram = url.includes('instagram.com') || url.includes('cdninstagram.com');
        const fetchUrl = isInstagram ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
        const res = await fetch(fetchUrl);
        const blob = await res.blob();
        href = URL.createObjectURL(blob);
      }
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (!url.startsWith('data:')) URL.revokeObjectURL(href);
    } catch (e) {
      console.error('Auto-download failed:', e);
    }
  };

  const handleNaverPhotos = async (query: string) => {
    setLoading(true);
    setStatusText('🗺️ 네이버 지도 사진 크롤링 중...');
    try {
      const res = await fetch('/api/naver-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const images: string[] = data.images || [];
      if (images.length === 0) throw new Error('사진을 찾지 못했습니다.');

      // base64 변환 후 referenceImages에 추가
      const settled = await Promise.allSettled(images.slice(0, 9).map(imgUrlToBase64));
      const b64s = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);

      setReferenceImages(prev => [...prev, ...b64s].slice(0, 12));
      setStatusText(`✅ 네이버 지도 사진 ${b64s.length}장 추가됨`);
    } catch (e: any) {
      setStatusText(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOnly = async (url: string) => {
    setLoading(true);
    setStatusText('이미지 가져오는 중...');
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const images: string[] = data.images || [];
      setStatusText(`✅ ${images.length}장 로드 완료!`);
    } catch (e: any) {
      setStatusText(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplateId(tpl.id);
    if (tpl.content) {
      setJsonlData(tpl.content);
      setStatusText(`✨ "${tpl.name}" 스타일 적용됨`);
    }
    if (tpl.source) setInstagramUrl(tpl.source);
    setCurrentStep(2);
  };

  const filteredTemplates = templateCategory === 'all'
    ? templates
    : templates.filter(t => t.category === templateCategory || (!t.category && templateCategory === '기타'));

  const handleGenerate = async () => {
    if (!jsonlData && !selectedTemplateId) return;
    setGenerating(true);
    setProgress(0);
    setCurrentStep(3);

    try {
      const activePortal = CLIENT_PORTALS[activeTab];
      const slideCount = activePortal?.slideCount ?? 3;
      setResultImages(Array(slideCount).fill(''));
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonlAnalysis: jsonlData || templates.find(t => t.id === selectedTemplateId)?.content,
          theme,
          reference: generationMode,
          // styleTemplateBase64: 레이아웃 고정용 카드뉴스 템플릿 이미지
          // referenceImageBase64: 콘텐츠 소스용 클라이언트 실제 사진
          styleTemplateBase64: styleTemplateBase64 || referenceImages[0] || '',
          referenceImageBase64: referenceImages[0] || '',
          clientContext: activePortal?.clientContext || '',
          slideCount,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: '생성 실패' }));
        throw new Error(err.error);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const labels6 = ['표지', '운영시간', '코스가격', '단품가격', '방문팁', 'CTA'];
      const labels3 = ['cover', 'content', 'closing'];
      const labels = slideCount === 6 ? labels6 : labels3;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.done) break;
          if (typeof event.index === 'number' && event.url) {
            setResultImages(prev => {
              const next = [...prev];
              next[event.index] = event.url;
              return next;
            });
            setProgress(((event.index + 1) / slideCount) * 100);
            autoDownload(event.url, `cardnews-${event.index + 1}-${labels[event.index]}.png`);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setStatusText(`오류: ${err.message}`);
      setCurrentStep(2);
    } finally {
      setGenerating(false);
    }
  };

  const handleAddReferenceImages = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target?.result as string;
        if (b64) setReferenceImages(prev => [...prev, b64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveReferenceImage = (idx: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== idx));
  };

  const steps = [
    { title: '스타일 선택', completed: !!selectedTemplateId || !!jsonlData },
    { title: '스타일 학습', completed: !!jsonlData },
    { title: '내용 입력', completed: !!theme },
    { title: '편집 및 저장', completed: resultImages.length > 0 }
  ];

  const navigableSteps: Record<number, number> = { 0: 0, 1: 0, 2: 2, 3: 3 };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.stepper}>
          {steps.map((s, i) => {
            const targetStep = navigableSteps[i] ?? i;
            return (
              <div
                key={i}
                className={`${styles.step} ${currentStep === i ? styles.activeStep : ''} ${s.completed ? styles.completedStep : ''}`}
                onClick={() => setCurrentStep(targetStep)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.stepCircle}>{s.completed ? '✓' : i + 1}</div>
                <span className={styles.stepTitle}>{s.title}</span>
              </div>
            );
          })}
        </div>
      </header>

      <div className={styles.content}>
        {/* 포털 탭 배너 (탭 선택됐을 때 상단 인디케이터) */}
        {CLIENT_PORTALS[activeTab] && (
          <div className={styles.portalBanner}>
            {/* 상단 행: 이름 + 버튼들 */}
            <div className={styles.portalBannerRow}>
              <span className={styles.portalBannerIcon}>{CLIENT_PORTALS[activeTab].icon}</span>
              <span className={styles.portalBannerName}>{CLIENT_PORTALS[activeTab].name} 전용 포털</span>
              {CLIENT_PORTALS[activeTab].clientInstagramUrl
                ? <span className={styles.portalBannerSub}>
                    {loading ? '로딩 중...' : referenceImages.length > 0 ? `사진 ${referenceImages.length}장 로드됨` : '사진 자동 로드 중...'}
                  </span>
                : <span className={styles.portalBannerSub} style={{ color: '#f59e0b' }}>⚠️ 인스타 URL 미연동</span>
              }
              <div className={styles.portalBannerActions}>
                {CLIENT_PORTALS[activeTab].clientInstagramUrl && (
                  <button
                    className={styles.portalBannerDownload}
                    onClick={() => handleDownloadOnly(CLIENT_PORTALS[activeTab].clientInstagramUrl)}
                    disabled={loading}
                    title="인스타그램 최근 게시물 다운로드"
                  >
                    {loading ? '...' : '↓ 인스타'}
                  </button>
                )}
                {CLIENT_PORTALS[activeTab].naverPlaceQuery && (
                  <button
                    className={styles.portalBannerDownload}
                    onClick={() => handleNaverPhotos(CLIENT_PORTALS[activeTab].naverPlaceQuery!)}
                    disabled={loading}
                    title="네이버 지도 사진 가져오기"
                  >
                    {loading ? '...' : '🗺️ 네이버'}
                  </button>
                )}
              </div>
            </div>

            {/* 썸네일 미리보기 스트립 */}
            {referenceImages.length > 0 && (
              <div className={styles.portalThumbStrip}>
                {referenceImages.map((b64, idx) => (
                  <div key={idx} className={styles.portalThumbItem}>
                    <img src={b64} alt={`ref-${idx + 1}`} className={styles.portalThumbImg} />
                    <button
                      className={styles.portalThumbRemove}
                      onClick={() => setReferenceImages(prev => prev.filter((_, i) => i !== idx))}
                      title="삭제"
                    >×</button>
                  </div>
                ))}
                {/* 사진 추가 버튼 */}
                <label className={styles.portalThumbAdd} title="사진 추가">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleAddReferenceImages(e.target.files)}
                  />
                  <span>+</span>
                </label>
              </div>
            )}
          </div>
        )}
        <>
            {currentStep === 0 && (
              <div className={styles.wizardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>인스타그램 스타일 학습</h2>
                  <p className={styles.sectionDesc}>분석하고 싶은 포스트 URL을 입력하세요. AI가 디자인 에스테틱을 추출합니다.</p>
                </div>

                <div className={styles.urlInputContainer}>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}>🔗</span>
                    <input
                      type="text"
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      placeholder="https://www.instagram.com/p/..."
                      className={styles.modernInput}
                    />
                  </div>
                  <button className={styles.modernBtn} onClick={() => handleFetchImages()}>
                    {loading ? '추출 중...' : '이미지 분석 시작'}
                  </button>
                </div>

                <div className={styles.quickTests}>
                  <p className={styles.quickLabel}>업종별 빠른 테스트:</p>
                  <div className={styles.chipGrid}>
                    {industryExamples.map(ex => {
                      const preview = examplePreviews[ex.url];
                      const isCached = !!clientAnalysisCache[normaliseUrl(ex.url)];
                      return (
                        <div key={ex.name} className={styles.chipWrapper}>
                          <button className={styles.modernChip} onClick={() => handleOneClickAnalyze(ex.url)}>
                            {preview ? (
                              <img
                                src={`/api/proxy?url=${encodeURIComponent(preview)}`}
                                alt={ex.name}
                                className={styles.chipThumb}
                              />
                            ) : (
                              <span className={styles.chipIcon}>📷</span>
                            )}
                            <span className={styles.chipLabel}>
                              {ex.name}
                              {isCached && <span className={styles.cachedBadge}> ✓</span>}
                            </span>
                          </button>
                          <button
                            className={styles.chipDownloadBtn}
                            onClick={() => handleDownloadOnly(ex.url)}
                            title="이미지만 다운로드"
                          >
                            ↓ 다운로드
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── 저장 레퍼런스 라이브러리 ── */}
                {templates.length > 0 && (
                  <div className={styles.templateLibrarySection}>
                    <div className={styles.sectionHeader} style={{ marginBottom: 12 }}>
                      <h3 className={styles.subTitle}>📌 저장 레퍼런스 라이브러리</h3>
                      <p className={styles.sectionDesc} style={{ fontSize: '0.85rem' }}>
                        인스타그램에서 저장한 레퍼런스를 스타일로 바로 적용하세요.
                      </p>
                    </div>

                    {/* 업종 필터 */}
                    <div className={styles.categoryFilterRow}>
                      {TEMPLATE_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          className={`${styles.categoryChip} ${templateCategory === cat.id ? styles.categoryChipActive : ''}`}
                          onClick={() => setTemplateCategory(cat.id)}
                        >
                          {cat.label}
                          <span className={styles.categoryCount}>
                            {cat.id === 'all'
                              ? templates.length
                              : templates.filter(t => t.category === cat.id || (!t.category && cat.id === '기타')).length
                            }
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* 템플릿 그리드 */}
                    <div className={styles.templateGrid}>
                      {filteredTemplates.map(tpl => (
                        <div
                          key={tpl.id}
                          className={`${styles.templateItem} ${selectedTemplateId === tpl.id ? styles.templateItemSelected : ''}`}
                          onClick={() => handleSelectTemplate(tpl)}
                        >
                          <div className={styles.templateThumbWrap}>
                            {tpl.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tpl.thumbnail.startsWith('/') ? tpl.thumbnail : `/api/proxy?url=${encodeURIComponent(tpl.thumbnail)}`}
                                alt={tpl.name}
                                className={styles.templateThumb}
                                loading="lazy"
                              />
                            ) : (
                              <div className={styles.templateThumbPlaceholder}>{tpl.name[0]}</div>
                            )}
                            {selectedTemplateId === tpl.id && <div className={styles.templateCheckBadge}>✓</div>}
                            {tpl.category && (
                              <span className={styles.templateCategoryBadge}>{tpl.category}</span>
                            )}
                          </div>
                          <p className={styles.templateName}>{tpl.name.replace('[저장] ', '')}</p>
                        </div>
                      ))}
                      {filteredTemplates.length === 0 && (
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '20px 0' }}>
                          이 업종의 레퍼런스가 없습니다.
                          <br />GPT 분석 후 자동으로 분류됩니다.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {extractedImages.length > 0 && (
                  <div className={styles.imageSelectorSection}>
                    <h3 className={styles.subTitle}>분석할 이미지를 선택하세요</h3>
                    <div className={styles.imageGrid}>
                      {extractedImages.map((img, i) => (
                        <div
                          key={i}
                          className={`${styles.imageItem} ${selectedImageIndex === i ? styles.selectedImg : ''}`}
                          onClick={() => setSelectedImageIndex(i)}
                        >
                          <img src={`/api/proxy?url=${encodeURIComponent(img)}`} alt="Reference" />
                        </div>
                      ))}
                    </div>
                    <div className={styles.actionGroup}>
                       <button className={styles.secondaryBtn} onClick={() => { setExtractedImages([]); setInstagramUrl(''); }}>초기화</button>
                       <button className={styles.modernBtn} onClick={() => handleAnalyze().then(() => setCurrentStep(2))}>선택한 스타일 분석 시작</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className={styles.wizardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>카드뉴스 내용 입력</h2>
                  <p className={styles.sectionDesc}>방금 학습한 디자인 DNA를 바탕으로 새로운 카드를 만듭니다.</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.modernLabel}>적용된 스타일</label>
                  <div className={`${styles.styleBadge} ${analyzing ? styles.pulse : ''}`}>
                    {analyzing ? (
                      <div className={styles.analysisProgressWrapper}>
                        <div className={styles.progressTextGroup}>
                          <span className={styles.analyzingText}>{statusText}</span>
                          <span className={styles.progressPercent}>{Math.round(progress)}%</span>
                        </div>
                        <div className={styles.miniProgressBar}>
                          <div className={styles.miniProgressFill} style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    ) : jsonlData ? (
                      <div className={styles.successBadge}>
                        <span className={styles.successIcon}>✨</span>
                        <span className={styles.successText}>커스텀 디자인 DNA 학습 완료</span>
                      </div>
                    ) : (
                      '⚠️ 선택된 스타일 없음 (분석 대기 중...)'
                    )}
                  </div>
                </div>
                <textarea
                  className={styles.textarea}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder={CLIENT_PORTALS[activeTab]?.placeholder || '카드뉴스에 담을 내용을 입력하세요...'}
                />

                <div className={styles.formGroup}>
                  <label className={styles.modernLabel}>
                    내 사진
                    <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                      {referenceImages.length > 0
                        ? `${referenceImages.length}장 로드됨 — 생성 시 내 사진 기반으로 적용`
                        : '선택 — 업로드하면 내 사진 기반으로 생성'}
                    </span>
                  </label>

                  {/* Thumbnail grid of loaded reference images */}
                  {referenceImages.length > 0 && (
                    <div className={styles.refThumbsGrid}>
                      {referenceImages.map((b64, idx) => (
                        <div key={idx} className={styles.refThumbWrap}>
                          <img src={b64} alt={`ref-${idx}`} className={styles.refThumb} />
                          <button
                            className={styles.refThumbRemove}
                            onClick={() => handleRemoveReferenceImage(idx)}
                            title="삭제"
                          >×</button>
                        </div>
                      ))}
                      {/* Add more button */}
                      <label className={styles.refThumbAdd} title="사진 추가">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => e.target.files && handleAddReferenceImages(e.target.files)}
                        />
                        <span>+</span>
                      </label>
                    </div>
                  )}

                  {referenceImages.length === 0 && (
                    <label className={styles.uploadArea}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => e.target.files && handleAddReferenceImages(e.target.files)}
                      />
                      <div className={styles.uploadPlaceholder}>
                        <span style={{ fontSize: '1.8rem' }}>📷</span>
                        <span>클릭해서 내 사진 업로드 (여러 장 가능)</span>
                      </div>
                    </label>
                  )}
                </div>

                <div className={styles.actionGroup}>
                  <button className="btn-secondary" onClick={() => setCurrentStep(0)}>← 스타일 재선택</button>
                  <button className="btn-primary" onClick={handleGenerate} disabled={generating || !jsonlData}>
                    {generating ? '생성 중...' : 'AI 카드뉴스 생성'}
                  </button>
                </div>

              </div>
            )}

            {currentStep === 3 && (
              <div className={styles.wizardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>생성 완료 🎉</h2>
                  <p className={styles.sectionDesc}>각 이미지를 클릭하면 확대해서 볼 수 있어요.</p>
                </div>
                <div className={styles.resultGrid}>
                  {(resultImages.length === 6
                    ? ['표지', '운영시간', '코스가격', '단품가격', '방문팁', 'CTA']
                    : ['COVER', 'CONTENT', 'CLOSING']
                  ).map((label, i) => (
                    <div key={i} className={styles.resultCard}>
                      <span className={styles.resultLabel}>{label}</span>
                      {resultImages[i] ? (
                        <>
                          <a href={resultImages[i]} target="_blank" rel="noopener noreferrer">
                            <img
                              src={resultImages[i]}
                              alt={label}
                              className={styles.resultImg}
                            />
                          </a>
                          <a
                            href={resultImages[i]}
                            download={`cardnews-${i + 1}-${label}.png`}
                            className={styles.resultDownloadBtn}
                          >
                            ↓ 다운로드
                          </a>
                        </>
                      ) : (
                        <div className={styles.resultSkeleton} />
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles.actionGroup} style={{ marginTop: '32px' }}>
                  <button className="btn-secondary" onClick={() => setCurrentStep(2)}>← 다시 생성하기</button>
                </div>
              </div>
            )}
        </>
      </div>

      {statusText && <div className={styles.toast}>{statusText}</div>}

      {generating && (
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingContent}>
            <div className={styles.spinnerRing} />
            <p className={styles.generatingLabel}>AI 카드뉴스 생성 중</p>
            <p className={styles.generatingTheme}>"{theme}"</p>
            <p className={styles.elapsedTime}>
              {Math.floor(elapsedSeconds / 60) > 0
                ? `${Math.floor(elapsedSeconds / 60)}분 ${elapsedSeconds % 60}초 경과`
                : `${elapsedSeconds}초 경과`}
              <span className={styles.elapsedNote}> · 보통 45~90초 소요</span>
            </p>
            <div className={styles.generatingSlots}>
              {['COVER', 'CONTENT', 'CLOSING'].map((label) => (
                <div key={label} className={styles.generatingSlot}>
                  <div className={styles.slotSkeleton} />
                  <span className={styles.slotLabel}>{label}</span>
                </div>
              ))}
            </div>
            <p className={styles.generatingTip}>{loadingTips[currentTipIndex]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
