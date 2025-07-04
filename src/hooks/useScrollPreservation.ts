import { useRef, useEffect } from 'react';

interface UseScrollPreservationOptions {
  dependencies: any[];
  enabled?: boolean;
}

export const useScrollPreservation = ({ 
  dependencies, 
  enabled = true 
}: UseScrollPreservationOptions) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // 保存滚动位置
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;

    const saveScrollPosition = () => {
      scrollPositionRef.current = element.scrollTop;
    };

    element.addEventListener('scroll', saveScrollPosition);
    return () => element.removeEventListener('scroll', saveScrollPosition);
  }, [enabled]);

  // 恢复滚动位置
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;

    // 使用 requestAnimationFrame 确保 DOM 更新完成
    requestAnimationFrame(() => {
      element.scrollTop = scrollPositionRef.current;
    });
  }, dependencies);

  return scrollRef;
};