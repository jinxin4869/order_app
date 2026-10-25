// 表示中のメニューの販売・受付状態を確認するフック。
// 表示中は15秒ごと、画面に戻ったとき、通信が戻ったときに取得する。
// 最終的な注文の可否はサーバーが注文時に判定する。
import { useCallback, useEffect, useRef, useState } from "react";
import { getMenuAvailability } from "../services/api";
import { useNetworkStatus } from "./useNetworkStatus";

const REFRESH_MS = 15000;

export const useMenuAvailability = (restaurantId, navigation) => {
  const [state, setState] = useState({
    ordering: null,
    soldOut: null,
    updatedAt: null,
    failed: false,
  });
  const { isOnline } = useNetworkStatus();
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const result = await getMenuAvailability(restaurantId);
      if (current !== request.current) return;
      setState({
        ordering: result.ordering,
        soldOut: new Set(result.soldOut),
        updatedAt: Date.now(),
        failed: false,
      });
    } catch {
      if (current === request.current)
        setState((previous) => ({ ...previous, failed: true }));
    }
  }, [restaurantId]);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const reload = () => loadRef.current();
    let timer = null;
    const start = () => {
      clearInterval(timer);
      reload();
      timer = setInterval(reload, REFRESH_MS);
    };
    start();
    // Only the screen in front polls; covered screens pause.
    const offFocus = navigation?.addListener?.("focus", start);
    const offBlur = navigation?.addListener?.("blur", () =>
      clearInterval(timer)
    );
    const requests = request;
    return () => {
      clearInterval(timer);
      offFocus?.();
      offBlur?.();
      requests.current++;
    };
  }, [navigation, restaurantId]);
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current) loadRef.current();
    wasOnline.current = isOnline;
  }, [isOnline]);
  // A refused order is newer news than the last check.
  const markSoldOut = useCallback(
    (itemId) =>
      setState((previous) => ({
        ...previous,
        soldOut: new Set([...(previous.soldOut || []), itemId]),
      })),
    []
  );
  return { ...state, refresh: load, markSoldOut };
};

// Before the first check, fall back to the state the menu was loaded with.
export const isSoldOut = (item, availability) =>
  availability.soldOut
    ? availability.soldOut.has(item.id)
    : item.is_available === false;
