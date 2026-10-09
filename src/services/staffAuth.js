import "./firebase";
import { Platform } from "react-native";
import {
  getAuth,
  onIdTokenChanged,
  getIdTokenResult,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";

export const observeStaffSession = (listener) => {
  let version = 0;
  const unsubscribe = onIdTokenChanged(getAuth(), async (user) => {
    const current = ++version;
    if (!user) {
      listener({ loading: false, user: null, restaurantId: null });
      return;
    }
    try {
      const { claims } = await getIdTokenResult(user);
      if (current !== version) return;
      const allowed =
        claims.role === "staff" &&
        typeof claims.restaurantId === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/.test(claims.restaurantId);
      listener({
        loading: false,
        user,
        restaurantId: allowed ? claims.restaurantId : null,
        error: allowed
          ? null
          : "スタッフ権限がありません。店舗管理者へ確認してください。",
      });
    } catch {
      if (current === version)
        listener({
          loading: false,
          user,
          restaurantId: null,
          error: "ログイン情報を確認できません。再ログインしてください。",
        });
    }
  });
  return () => {
    version++;
    unsubscribe();
  };
};
export const signInStaff = async (email, password) => {
  const auth = getAuth();
  if (Platform.OS === "web")
    await setPersistence(auth, browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email.trim(), password);
};
export const signOutStaff = () => signOut(getAuth());
