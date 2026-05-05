import { useState } from 'react';

export function useCardNews() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [jsonlData, setJsonlData] = useState('');
  const [resultImage, setResultImage] = useState('');

  const fetchImages = async (url: string) => {
    setLoading(true);
    setStatus('이미지 추출 중...');
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractedImages(data.images);
      setStatus('추출 완료');
    } catch (e: any) {
      setStatus(`에러: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const analyze = async (imageUrl: string) => {
    setLoading(true);
    setStatus('디자인 분석 중...');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJsonlData(data.analysis);
      setStatus('분석 완료');
    } catch (e: any) {
      setStatus(`에러: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generate = async (theme: string) => {
    setLoading(true);
    setStatus('이미지 생성 중...');
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonlAnalysis: jsonlData, theme })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultImage(data.transformedUrl);
      setStatus('생성 완료');
    } catch (e: any) {
      setStatus(`에러: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    status,
    extractedImages,
    jsonlData,
    resultImage,
    setJsonlData,
    fetchImages,
    analyze,
    generate
  };
}
